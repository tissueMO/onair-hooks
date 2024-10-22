const { Client, Guild, CommandInteraction, VoiceChannel, ChannelType, ApplicationCommandOptionType } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType, VoiceConnection } = require('@discordjs/voice');
const Addon = require('./Addon');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const { v4: uuid } = require('uuid');
const path = require('path');
const prism = require('prism-media');
const { createRedisClient } = require('../common');
const PcmToWavWorker = require('../worker/ConvertWorker');
const { RedisClientType } = require('@redis/client');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

/**
 * 任意のボイスチャンネルの文字起こしと要約を行います。
 */
class RecordAddon extends Addon {
  /**
   * @type {VoiceConnection?}
   */
  #connection;

  /**
   * @type {RedisClientType}
   */
  #redisClient;

  /**
   * 登録するコマンド一覧
   */
  static get COMMANDS() {
    return [
      {
        name: 'record-start',
        description: 'ボイスチャンネルに議事録要約Botを参加させます。',
      },
      {
        name: 'record-end',
        description: 'ボイスチャンネルから議事録要約Botを退出させます。',
      },
      {
        name: 'record-view',
        description: '指定したチャンネルの時間範囲における文字起こしを取得します。',
        options: [
          {
            name: 'channel',
            description: '対象チャンネル',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
            required: true,
          },
          {
            name: 'start',
            description: '時刻始点(HH:mm)',
            type: ApplicationCommandOptionType.String,
            minLength: 5,
            maxLength: 5,
            required: true,
          },
          {
            name: 'end',
            description: '時刻終端(HH:mm)',
            type: ApplicationCommandOptionType.String,
            minLength: 5,
            maxLength: 5,
            required: true,
          },
        ],
      },
      {
        name: 'record-summary',
        description: '指定したチャンネルの時間範囲における要約を取得します。',
        options: [
          {
            name: 'channel',
            description: '対象チャンネル',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
            required: true,
          },
          {
            name: 'start',
            description: '時刻始点(HH:mm)',
            type: ApplicationCommandOptionType.String,
            minLength: 5,
            maxLength: 5,
            required: true,
          },
          {
            name: 'end',
            description: '時刻終端(HH:mm)',
            type: ApplicationCommandOptionType.String,
            minLength: 5,
            maxLength: 5,
            required: true,
          },
        ],
      },
    ];
  }

  /**
   * @override
   */
  get configKey() {
    return 'records';
  }

  /**
   * @override
   * @param {Client} client
   * @param {Guild} guild
   */
  async initialize(client, guild) {
    super.initialize(client, guild);

    // スラッシュコマンドを追加
    if (this.settings[guild.id].length > 0) {
      await Promise.all(RecordAddon.COMMANDS.map((command) => client.application.commands.create(command, guild.id)));
      console.info(`[RecordAddon] <${guild.name}> コマンドを登録しました。`);
    } else {
      console.info(`[RecordAddon] <${guild.name}> このサーバーでは無効です。`);
      return;
    }

    // Redis 接続
    this.#redisClient = await createRedisClient();

    // コマンドハンドリング
    client.on('interactionCreate', async (/** @type {CommandInteraction} */ interaction) => {
      if (interaction.guildId !== guild.id || !interaction.isCommand()) {
        return;
      }

      /** @type {VoiceChannel} 呼び出したユーザーが参加しているボイスチャンネル */
      const channel = interaction.member.voice?.channel;

      // コマンド別
      switch (interaction.commandName) {
        case 'record-start':
          console.info(`[RecordAddon] <${guild.name}> コマンド: 記録開始`);

          if (!channel) {
            await interaction.reply({
              content: 'ボイスチャンネルに参加してから呼び出してください。',
              ephemeral: true,
            });
            return;
          }

          this.#connection?.destroy();

          const connection = joinVoiceChannel({
            guildId: interaction.guildId,
            channelId: channel.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfMute: true,
            selfDeaf: false,
          });

          const context = {};

          // ユーザーの発話ごとに音声を記録
          connection.receiver.speaking.on('start', async (userId) => {
            if (context[userId]) {
              return;
            }

            // 記録データ作成
            const sessionId = uuid();
            const userContext = {
              sessionId,
              channel: channel.id,
              userId,
              userName: guild.members.cache.get(userId).displayName,
              start: dayjs().tz().format(),
            };
            context[userId] = userContext;

            const pcmFile = path.join(process.env.WORKER_PATH, `${sessionId}.pcm`);

            // キャプチャー開始
            console.info(`[RecordAddon] キャプチャー開始: User<${userId}> Session<${sessionId}>`);
            try {
              await pipeline(
                connection.receiver.subscribe(userId, {
                  end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 3000,
                  },
                }),
                new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }),
                createWriteStream(pcmFile)
              );
              console.info(`[RecordAddon] キャプチャー終了: User<${userId}> Session<${sessionId}> --> ${pcmFile}`);

            } catch (err) {
              console.error(`[RecordAddon] キャプチャー失敗: User<${userId}> Session<${sessionId}>`, err);
              return;

            } finally {
              delete context[userId];
            }

            // コンテキストを保存して音声変換ワーカーにキューイング
            userContext['end'] = dayjs().tz().format();
            userContext['transcription'] = null;

            const firstWorkerPrefix = new PcmToWavWorker().prefix;

            await this.#redisClient.multi()
              .setEx(`context:${sessionId}`, 43200, JSON.stringify(userContext))
              .zAdd(`sessions`, { score: dayjs(userContext.start).valueOf(), value: sessionId })
              .lPush(`${firstWorkerPrefix}:queue`, sessionId)
              .exec();

            console.info('[RecordAddon] キャプチャー完了:', userContext);
          });

          this.#connection = connection;

          await interaction.reply({
            content: `${channel} に参加しました。`,
            ephemeral: true,
          });

          console.info(`[RecordAddon] Botが <${channel.name}> に参加しました。`);
          break;

        case 'record-end':
          console.info(`[RecordAddon] <${guild.name}> コマンド: 記録終了`);

          await interaction.reply({
            content: 'OK',
            ephemeral: true,
          });

          this.#connection?.disconnect();
          break;

        case 'record-view':
          console.info(`[RecordAddon] <${guild.name}> コマンド: 文字起こし`);

          // 指定範囲の文字起こしを取得
          const now = dayjs().tz().format('YYYY-MM-DD');
          const start = dayjs.tz(`${now}T${interaction.options.getString('start')}:00Z`);
          const end = dayjs.tz(`${now}T${interaction.options.getString('end')}:00Z`);
          const targetChannel = interaction.options.getChannel('channel');

          await interaction.deferReply({ ephemeral: true });

          const sessionIds = await this.#redisClient.zRangeByScore('sessions', start.valueOf(), end.valueOf());
          if (sessionIds.length === 0) {
            await interaction.editReply('該当期間の記録データがありません。');
            break;
          }

          /** @type {Array} */
          const contexts = await this.#redisClient.mGet(sessionIds.map(id => `context:${id}`))
            .then(contexts => contexts.map(context => context ? JSON.parse(context) : null))
            .then(contexts => contexts.filter(context => context?.channel === targetChannel.id));

          if (contexts.length === 0) {
            await interaction.editReply('該当期間の該当チャンネルの記録データがありません。');
            break;
          }
          if (contexts.some(context => !context.transcription)) {
            await interaction.editReply('該当期間の一部が処理中です。しばらく待ってから再度実行してください。');
            break;
          }

          const text = `${now} ${start.format('HH:mm')}-${end.format('HH:mm')} ${targetChannel} にて:\n\n` +
            contexts
              .map(context => `[${dayjs.tz(context.start).format('HH:mm')}] ${context.userName}「${context.transcription}」`)
              .join('\n');

          await interaction.editReply(text);
          break;

        case 'record-summary':
          // 指定範囲の要約
          // const now = new Date();
          // const start = new Date(`${now.toLocaleDateString()} ${interaction.options.getString('start')}`);
          // const end = new Date(`${now.toLocaleDateString()} ${interaction.options.getString('end')}`);
          // const targetChannel = interaction.options.getChannel('channel');

          // await interaction.deferReply();
          // TODO: Redisから指定範囲の文字起こしを取得 > Open WebUI API 経由で要約
          // await interaction.editReply(text);
          break;
      }
    });

    // 誰もいなくなったら自動で退出する
    client.on('voiceStateUpdate', (oldState, newState) => {
      const botId = client.user.id;
      const currentChannel = oldState.guild.channels.cache.find(channel => channel.type === ChannelType.GuildVoice && channel.members.has(botId));

      if (currentChannel) {
        const members = currentChannel.members.filter(member => !member.user.bot);

        if (members.size === 0) {
          this.#connection?.disconnect();
          console.info('[RecordAddon] Botが退出しました。');
        }
      }
    });
  }
}

module.exports = RecordAddon;
