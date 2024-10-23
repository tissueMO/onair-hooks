const { Client, Guild, CommandInteraction, VoiceChannel, ChannelType, ApplicationCommandOptionType } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType, VoiceConnection } = require('@discordjs/voice');
const Addon = require('./Addon');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const { v4: uuid } = require('uuid');
const path = require('path');
const prism = require('prism-media');
const { createRedisClient } = require('../common');
const ConvertWorker = require('../worker/ConvertWorker');
const { RedisClientType } = require('@redis/client');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const { default: axios } = require('axios');

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
   * @type {Object}
   */
  #contexts;

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

      // 文字起こし開始コマンド
      if (interaction.commandName === 'record-start') {
        console.info(`[RecordAddon] <${guild.name}> コマンド: 記録開始`);

        if (!channel) {
          await interaction.reply({
            content: 'ボイスチャンネルに参加してから呼び出してください。',
            ephemeral: true,
          });
          return;
        }

        this.#connection?.destroy();
        this.#contexts = {};

        // Botをボイスチャンネルに参加させる
        const connection = joinVoiceChannel({
          guildId: interaction.guildId,
          channelId: channel.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfMute: true,
          selfDeaf: false,
        });

        // ユーザーの発話ごとに音声を記録する
        connection.receiver.speaking.on('start', async (userId) => {
          if (!this.#contexts[userId]) {
            await Promise.resolve()
              .then(() => this.#capture(connection, {
                sessionId: uuid(),
                channelId: channel.id,
                userId,
                userName: guild.members.cache.get(userId).displayName,
                start: dayjs().tz().format(),
              }))
              .then(context => this.#enqueueConvertWorker(context));
          }
        });

        this.#connection = connection;

        await interaction.reply({
          content: `${channel} に参加しました。`,
          ephemeral: true,
        });

        console.info(`[RecordAddon] Botが <${channel.name}> に参加しました。`);
      }

      // 記録終了コマンド
      if (interaction.commandName === 'record-end') {
        console.info(`[RecordAddon] <${guild.name}> コマンド: 記録終了`);

        await interaction.reply({
          content: 'OK',
          ephemeral: true,
        });

        this.#connection?.disconnect();
        console.info(`[RecordAddon] Botが <${channel.name}> から退出しました。`);
      }

      // 指定範囲の文字起こし取得コマンド
      if (interaction.commandName === 'record-view') {
        console.info(`[RecordAddon] <${guild.name}> コマンド: 文字起こし`);

        const now = dayjs().tz().format('YYYY-MM-DD');
        const start = dayjs.tz(`${now}T${interaction.options.getString('start')}:00Z`);
        const end = dayjs.tz(`${now}T${interaction.options.getString('end')}:00Z`);
        const targetChannel = interaction.options.getChannel('channel');

        await interaction.deferReply({ ephemeral: true });

        const transcription = await this.#fetchTranscription(targetChannel, start, end);

        if (transcription) {
          await interaction.editReply(transcription);
        } else {
          await interaction.editReply('該当期間の記録データがありません。');
        }
      }

      // 指定範囲の要約コマンド
      if (interaction.commandName === 'record-summary') {
        console.info(`[RecordAddon] <${guild.name}> コマンド: 要約`);

        const now = dayjs().tz().format('YYYY-MM-DD');
        const start = dayjs.tz(`${now}T${interaction.options.getString('start')}:00Z`);
        const end = dayjs.tz(`${now}T${interaction.options.getString('end')}:00Z`);
        const targetChannel = interaction.options.getChannel('channel');

        await interaction.deferReply({ ephemeral: true });

        const summary = await this.#summarize(targetChannel, start, end);

        if (summary) {
          await interaction.editReply(summary);
        } else {
          await interaction.editReply('該当期間の記録データがありません。');
        }
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
          console.info(`[RecordAddon] Botが <${currentChannel.name}> 退出しました。`);
        }
      }
    });
  }

  /**
   * ユーザーの音声をキャプチャーします。
   * @param {VoiceConnection} connection
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async #capture(connection, context) {
    const { sessionId, userId } = context;
    const pcmFile = path.join(process.env.WORKER_PATH, `${sessionId}.pcm`);

    try {
      console.info(`[RecordAddon] キャプチャー開始: User<${userId}> Session<${sessionId}>`);
      this.#contexts[userId] = context;

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
      delete this.#contexts[userId];
    }

    return context;
  }

  /**
   * キャプチャー結果を音声変換ワーカーにキューイングします。
   * @param {Object} context
   * @returns {Promise<void>}
   */
  async #enqueueConvertWorker(context) {
    const { sessionId, start } = context;
    const workerPrefix = new ConvertWorker().prefix;

    await this.#redisClient.multi()
      .setEx(`context:${sessionId}`, 43200, JSON.stringify(context))
      .zAdd(`sessions`, { score: dayjs(start).valueOf(), value: sessionId })
      .lPush(`${workerPrefix}:queue`, sessionId)
      .exec();
  }

  /**
   * 指定時間範囲の文字起こしを取得します。
   * @param {VoiceChannel} channel
   * @param {dayjs.Dayjs} start
   * @param {dayjs.Dayjs} end
   * @returns {string|null}
   */
  async #fetchTranscription(channel, start, end) {
    const sessionIds = await this.#redisClient.zRangeByScore('sessions', start.valueOf(), end.valueOf());
    if (sessionIds.length === 0) {
      console.info('[RecordAddon] 該当期間の記録データがありません。');
      return null;
    }

    /** @type {Array} */
    const contexts = await this.#redisClient.mGet(sessionIds.map(id => `context:${id}`))
      .then(contexts => contexts.map(context => context ? JSON.parse(context) : null))
      .then(contexts => contexts.filter(context => context?.channelId === channel.id));

    if (contexts.length === 0) {
      console.info('[RecordAddon] 該当期間の該当チャンネルの記録データがありません。');
      return null;
    }
    if (contexts.some(context => !context.transcription)) {
      console.info('[RecordAddon] 該当期間の一部が文字起こし処理中です。');
      return null;
    }

    const now = dayjs().tz().format('YYYY-MM-DD');
    const header = `${now} ${start.format('HH:mm')}-${end.format('HH:mm')} ${channel} にて:`;
    const lines = contexts
      .map(context => ({ ...context, transcription: context.transcription.replace(/\n/g, '。') }))
      .map(context => `[${dayjs(context.start).tz().format('HH:mm')}] ${context.userName}「${context.transcription}」`);

    return header + '\n\n' + lines.join('\n');
  }

  /**
   * 指定時間範囲の文字起こしを取得します。
   * @param {VoiceChannel} channel
   * @param {dayjs.Dayjs} start
   * @param {dayjs.Dayjs} end
   * @returns {string|null}
   */
  async #summarize(channel, start, end) {
    const transcription = await this.#fetchTranscription(channel, start, end);
    if (!transcription) {
      return null;
    }

    const { data } = await axios.post(`${process.env.OPEN_WEBUI_HOST}/api/chat/completions`,
      {
        model: 'summarize',
        messages: [
          {
            role: 'user',
            content: transcription,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPEN_WEBUI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const summary = data.choices[0]?.message?.content;

    console.log(`[RecordAddon] トークン消費:`, data.usage);

    return summary;
  }
}

module.exports = RecordAddon;
