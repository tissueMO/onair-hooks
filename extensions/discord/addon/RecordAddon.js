const { Client, Guild, CommandInteraction } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const Addon = require('./Addon');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const { v4: uuid } = require('uuid');
const path = require('path');
const prism = require('prism-media');
const { createRedisClient } = require('../common');
const PcmToWavWorker = require('../worker/PcmToWavWorker');
const { RedisClientType } = require('@redis/client');

/**
 * 任意のボイスチャンネルの文字起こしと要約を行います。
 */
class RecordAddon extends Addon {
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
      },
      {
        name: 'record-summary',
        description: '指定したチャンネルの時間範囲における要約を取得します。',
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

    // TODO: Botが参加しているボイスチャンネルを監視して、全員いなくなったら自動で退出する

    // コマンドハンドリング
    client.on('interactionCreate', async (/** @type {CommandInteraction} */ interaction) => {
        if (interaction.guildId !== guild.id || !interaction.isCommand()) {
          return;
        }

        // 呼び出したユーザーが参加しているボイスチャンネル
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
                start: new Date(),
              };
              context[userId] = userContext;

              const pcmFile = path.join('/tmp', `${uuid()}.pcm`);

              // キャプチャー開始
              console.info(`キャプチャー開始: User<${userId}> Session<${sessionId}>`);
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
                console.info(`キャプチャー終了: User<${userId}> Session<${sessionId}> --> ${pcmFile}`);

              } catch (err) {
                console.error(`キャプチャー失敗: User<${userId}> Session<${sessionId}>`, err);
                return;

              } finally {
                delete context[userId];
              }

              // コンテキストを保存して音声変換ワーカーにキューイング
              userContext['end'] = new Date();
              userContext['transcription'] = null;

              const pcmData = await fs.readFile(pcmFile);
              const firstWorkerPrefix = new PcmToWavWorker().prefix;

              await this.#redisClient.multi()
                .setEx(`context:${sessionId}`, 43200, JSON.stringify(userContext))
                .zAdd(`sessions`, { score: userContext.start.getTime(), value: sessionId })
                .lPush(`${firstWorkerPrefix}:queue`, sessionId)
                .setEx(`${firstWorkerPrefix}:data:input:${sessionId}`, 3600, pcmData)
                .exec();

              // 後片付け
              await fs.unlink(pcmFile);

              console.info('キャプチャー完了:', userContext);
            });

            this.#connection = connection;

            await interaction.reply({
              content: `${channel} に参加しました。`,
              ephemeral: true,
            });
            break;

          case 'record-end':
            console.info(`[RecordAddon] <${guild.name}> コマンド: 記録終了`);

            this.#connection?.disconnect();

            await interaction.reply({
              content: 'OK',
              ephemeral: true,
            });
            break;

          case 'record-view':
            // TODO: Redisから指定範囲の文字起こしを取得
            // await interaction.deferReply({ ephemeral: true });
            break;

          case 'record-summary':
            // TODO: Redisから指定範囲の文字起こしを取得 > Open WebUI API 経由で要約
            // await interaction.deferReply({ ephemeral: true });
            break;
        }
      },
    );
  }
}

module.exports = RecordAddon;
