const { Client, Guild, CommandInteraction } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const Addon = require('./Addon');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { v4: uuid } = require('uuid');
const path = require('path');
const prism = require('prism-media');
const { pcmToWav } = require('../common');
const FormData = require('form-data');
const { Agent } = require('http');
const axios = require('axios').default;

/**
 * 任意のボイスチャンネルの文字起こしと要約を行います。
 */
class RecordAddon extends Addon {
  #connection;

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
    }

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
              context[userId] = {
                channel: channel.id,
                userId,
                userName: guild.members.cache.get(userId).displayName,
                start: new Date(),
              };

              // 生成ファイル定義
              const baseFile = path.join('/tmp', `${uuid()}`);
              const pcmFile = `${baseFile}.pcm`;
              const wavFile = `${baseFile}.wav`;

              // キャプチャー開始
              console.info(`キャプチャー開始: ${userId}`);
              try {
                await pipeline(
                  connection.receiver.subscribe(userId, {
                    end: {
                      behavior: EndBehaviorType.AfterSilence,
                      duration: 3000,
                    },
                  }),
                  new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }),
                  fs.createWriteStream(pcmFile)
                );

                // PCMからWave形式に変換
                await pcmToWav(pcmFile, wavFile);

              } catch (err) {
                console.error(`キャプチャー失敗: ${baseFile}`, context[userId], err);
                delete context[userId];
                return;
              }

              console.info(`キャプチャー終了: ${wavFile}`);

              // キャプチャー完了
              context[userId]['end'] = new Date();

              // 文字起こし実行
              const whisperClient = axios.create({
                timeout: 300000,
                httpAgent: new Agent({ keepAlive: true }),
              });
              const requestData = new FormData();
              requestData.append('file', fs.createReadStream(wavFile));
              const { data } = await whisperClient.post('http://whisper:5000/transcribe', requestData, { headers: requestData.getHeaders() });
              context[userId]['transcription'] = data['transcription'] ?? '(文字起こし失敗)';

              // TODO: 結果とコンテキストを合わせてRedisへ格納

              console.info('キャプチャー完了:', context[userId]);
              delete context[userId];
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
