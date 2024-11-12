const { Client, Guild, CommandInteraction, VoiceChannel, ChannelType, ApplicationCommandOptionType } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType, VoiceConnection, createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const Addon = require('./Addon');
const { createWriteStream, createReadStream } = require('fs');
const { pipeline } = require('stream/promises');
const { v4: uuid } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const prism = require('prism-media');
const { createRedisClient, parseTime } = require('../common');
const ConvertWorker = require('../worker/ConvertWorker');
const { RedisClientType } = require('@redis/client');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const { default: axios } = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { setTimeout } = require('timers/promises');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

const s3Client = new S3Client();

const DEFAULT_EXPIRES = 43200;

/**
 * 任意のボイスチャンネルの文字起こしと要約を行います。
 */
class RecordAddon extends Addon {
  /**
   * @type {Client[]}
   */
  static #clients;

  /**
   * @type {Object}
   */
  static #connections;

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
        options: [
          {
            name: 'silent',
            description: 'Botが退出しても要約を自動生成しません。',
            type: ApplicationCommandOptionType.Boolean,
          },
          {
            name: 'channel',
            description: '参加チャンネル',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          },
        ],
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
      {
        name: 'speak',
        description: '参加中のボイスチャンネル上で任意の文章を発話させます。',
        options: [
          {
            name: 'text',
            description: '発話内容',
            type: ApplicationCommandOptionType.String,
            required: true,
          }
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

    RecordAddon.#clients ??= [];
    RecordAddon.#clients.push(client);

    this.#contexts = {};
    this.#redisClient = await createRedisClient();

    // スラッシュコマンドはプライマリBotのみ有効とする
    if (client.user.id === process.env.PRIMARY_BOT_ID) {
      RecordAddon.#connections = {};

      // スラッシュコマンドを追加
      if (this.settings[guild.id].length > 0) {
        await Promise.all(RecordAddon.COMMANDS.map((command) => client.application.commands.create(command, guild.id)));
        console.info(`[RecordAddon] <${guild.name}> コマンドを登録しました。`);
      } else {
        console.info(`[RecordAddon] <${guild.name}> このサーバーでは無効です。`);
        return;
      }

      // コマンドハンドリング ※一部先発クライアントが後発クライアントを操作するケースあり
      client.on('interactionCreate', async (/** @type {CommandInteraction} */ interaction) => {
        if (interaction.guildId !== guild.id || !interaction.isCommand()) {
          return;
        }

        // 古いデータをクリア
        await this.#clean(guild.id);

        /** @type {VoiceChannel} 呼び出したユーザーが参加しているボイスチャンネル */
        const channel = interaction.options.getChannel('channel') ?? interaction.member.voice?.channel;

        // 文字起こし開始コマンド
        if (interaction.commandName === 'record-start') {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 記録開始`);

          if (!channel) {
            await interaction.reply({
              content: 'ボイスチャンネルに参加してから呼び出すか、チャンネルを指定してください。',
              ephemeral: true,
            });
            return;
          }

          const joined = channel.members.filter(member => member.user.bot).size > 0;
          if (joined) {
            await interaction.reply({
              content: 'Botは既に参加しています。',
              ephemeral: true,
            });
            return;
          }

          // アイドルクライアント取得
          const targetClient = RecordAddon.#poolClient();
          const botId = targetClient?.user?.id;

          if (!targetClient) {
            await interaction.reply({
              content: 'ボイスチャンネルに参加できるBotがいません。',
              ephemeral: true,
            });
            return;
          }

          RecordAddon.#connections[botId]?.connection?.destroy();

          // Botをボイスチャンネルに参加させる
          const connection = joinVoiceChannel({
            guildId: interaction.guildId,
            channelId: channel.id,
            group: channel.name,
            adapterCreator: targetClient.guilds.cache.get(interaction.guildId).voiceAdapterCreator,
            selfMute: false,
            selfDeaf: false,
          });

          // ユーザーの発話ごとに音声を記録する
          connection.receiver.speaking.on('start', async (userId) => {
            if (!this.#contexts[userId]) {
              await Promise.resolve()
                .then(() => this.#capture(connection, {
                  contextId: uuid(),
                  guildId: guild.id,
                  channelId: channel.id,
                  userId,
                  userName: guild.members.cache.get(userId).displayName,
                  start: dayjs().tz().format(),
                }))
                .then(context => {
                  if (context) {
                    this.#enqueueConvertWorker(context);
                  }
                });
            }
          });

          RecordAddon.#connections[botId] = {
            connection: connection,
            start: dayjs().tz().format(),
            autoSummary: !interaction.options.getBoolean('silent'),
          };

          await interaction.reply({
            content: `${channel} に参加しました。`,
            ephemeral: true,
          });

          console.info(`[RecordAddon] Botが <${channel.name}> に参加しました。`);
        }

        // 記録終了コマンド
        if (interaction.commandName === 'record-end') {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 記録終了`);

          if (!channel) {
            await interaction.reply({
              content: 'ボイスチャンネルに参加させてから呼び出してください。',
              ephemeral: true,
            });
            return;
          }

          // Bot取得
          const botId = channel.members.filter(member => member.user.bot).at(0)?.user?.id;
          if (!botId) {
            await interaction.reply({
              content: '対象となるBotがいません。',
              ephemeral: true,
            });
            return;
          }

          await interaction.reply({
            content: 'OK',
            ephemeral: true,
          });

          // Bot切断
          RecordAddon.#connections[botId]?.connection?.disconnect();
        }

        // 指定範囲の文字起こし取得コマンド
        if (interaction.commandName === 'record-view') {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 文字起こし`);

          const start = parseTime(interaction.options.getString('start'));
          const end = parseTime(interaction.options.getString('end'));
          const targetChannel = interaction.options.getChannel('channel');

          if (!start || !end) {
            await interaction.reply({
              content: '時刻は HH:mm 形式で入力してください。',
              ephemeral: true,
            });
            return;
          }

          await interaction.deferReply({ ephemeral: true });

          const transcription = await this.#fetchTranscription(targetChannel, start, end);

          if (transcription) {
            // 添付ファイルとして送信
            const file = `/tmp/${uuid()}.log`;
            await fs.writeFile(file, transcription, { encoding: 'utf8' });
            await interaction.channel.send({ files: [file] });
            await fs.unlink(file);

            await interaction.editReply('OK');
          } else {
            await interaction.editReply('該当期間の記録データがありません。');
          }
        }

        // 指定範囲の要約コマンド
        if (interaction.commandName === 'record-summary') {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 要約`);

          const start = parseTime(interaction.options.getString('start'));
          const end = parseTime(interaction.options.getString('end'));
          const targetChannel = interaction.options.getChannel('channel');

          if (!start || !end) {
            await interaction.reply({
              content: '時刻は HH:mm 形式で入力してください。',
              ephemeral: true,
            });
            return;
          }

          await interaction.deferReply({ ephemeral: true });

          const summary = await this.#summarize(targetChannel, start, end);

          if (summary) {
            await interaction.channel.send(summary);
            await interaction.editReply('OK');
          } else {
            await interaction.editReply('該当期間の記録データがありません。');
          }
        }

        // 発話コマンド
        if (interaction.commandName === 'speak') {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 発話`);

          if (!channel) {
            await interaction.reply({
              content: 'ボイスチャンネルに参加させてから呼び出してください。',
              ephemeral: true,
            });
            return;
          }

          // Bot取得
          const botId = channel.members.filter(member => member.user.bot).at(0)?.user?.id;
          if (!botId) {
            await interaction.reply({
              content: '対象となるBotがいません。',
              ephemeral: true,
            });
            return;
          }

          await interaction.reply({
            content: 'OK',
            ephemeral: true,
          });

          // 発話
          await this.#speak(RecordAddon.#connections[botId]?.connection, interaction.options.getString('text'))
        }
      });
    }

    // ボイスチャンネルの退出を監視
    client.on('voiceStateUpdate', async (oldState, newState) => {
      const botId = client.user.id;
      const channel = oldState.guild.channels.cache.find(channel => channel.type === ChannelType.GuildVoice && channel.members.has(botId));

      // 誰もいなくなったら退出する
      if (channel) {
        const members = channel.members.filter(member => !member.user.bot);

        if (members.size === 0) {
          RecordAddon.#connections[botId]?.connection?.disconnect();
        }
      }

      // Bot自身が退出したときにコネクションを破棄する
      if (newState.id === botId && oldState.channelId !== null && newState.channelId === null) {
        const connection = RecordAddon.#connections[botId];
        if (!connection) {
          return;
        }

        const start = dayjs(connection.start).tz();
        const end = dayjs().tz();
        const autoSummary = connection.autoSummary;

        connection.connection.destroy();
        delete RecordAddon.#connections[botId];

        const previousChannel = await oldState.guild.channels.fetch(oldState.channelId);
        console.info(`[RecordAddon] Botが <${previousChannel.name}> から退出しました。`);

        // デフォルトチャンネルに対して一定時間後に要約呼び出し
        if (autoSummary && process.env.DEFAULT_CHANNEL_ID) {
          console.info(`[RecordAddon] 30秒後に要約します。`);
          await setTimeout(30000);

          const summary = await this.#summarize(previousChannel, start, end);
          if (summary) {
            await client.channels.cache.get(process.env.DEFAULT_CHANNEL_ID).send(summary);
          } else {
            console.info(`[RecordAddon] 該当期間の記録データがありません。`);
          }
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
    const { contextId, userId } = context;
    const baseName = `${contextId}.pcm`;
    const pcmFile = path.join(process.env.WORKER_PATH, baseName);

    try {
      console.info(`[RecordAddon] キャプチャー開始: User<${userId}> Session<${contextId}>`);
      this.#contexts[userId] = context;

      await pipeline(
        connection.receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000,
          },
        }),
        new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }),
        createWriteStream(pcmFile)
      );

      context['end'] = dayjs().tz().format();

      // ※相槌やノイズのような短い音声は除外
      const start = dayjs(context.start);
      const end = dayjs(context.end);
      const timeSpan = end.diff(start, 'second');

      if (timeSpan <= 3) {
        console.info(`[RecordAddon] キャプチャーキャンセル: User<${userId}> Session<${contextId}>`);
        return null;
      }

      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${process.env.S3_PREFIX}${baseName}`,
        Body: createReadStream(pcmFile),
      }));

      console.info(`[RecordAddon] キャプチャー終了: User<${userId}> Session<${contextId}> --> ${pcmFile}`);
      return context;

    } catch (err) {
      console.error(`[RecordAddon] キャプチャー失敗: User<${userId}> Session<${contextId}>`, err);
      return null;

    } finally {
      await fs.unlink(pcmFile);
      delete this.#contexts[userId];
    }
  }

  /**
   * キャプチャー結果を音声変換ワーカーにキューイングします。
   * @param {Object} context
   * @returns {Promise<void>}
   */
  async #enqueueConvertWorker(context) {
    const { contextId, guildId, start } = context;
    const workerPrefix = new ConvertWorker().prefix;

    await this.#redisClient.multi()
      .setEx(`${process.env.REDIS_NAMESPACE}:context:${contextId}`, this.settings[guildId]?.expires ?? DEFAULT_EXPIRES, JSON.stringify(context))
      .zAdd(`${process.env.REDIS_NAMESPACE}:contexts`, { score: dayjs(start).valueOf(), value: contextId })
      .lPush(`${process.env.REDIS_NAMESPACE}:${workerPrefix}:queue`, contextId)
      .exec();
  }

  /**
   * 指定時間範囲の文字起こしを取得します。
   * @param {VoiceChannel} channel
   * @param {dayjs.Dayjs} start
   * @param {dayjs.Dayjs} end
   * @returns {Promise<string|null>}
   */
  async #fetchTranscription(channel, start, end) {
    const contextIds = await this.#redisClient.zRangeByScore(`${process.env.REDIS_NAMESPACE}:contexts`, start.valueOf(), end.valueOf());
    if (contextIds.length === 0) {
      console.info('[RecordAddon] 該当期間の記録データがありません。');
      return null;
    }

    /** @type {Array} */
    const contexts = await this.#redisClient.mGet(contextIds.map(id => `${process.env.REDIS_NAMESPACE}:context:${id}`))
      .then(contexts => contexts.map(context => context ? JSON.parse(context) : null))
      .then(contexts => contexts.filter(context => context?.channelId === channel.id));

    if (contexts.length === 0) {
      console.info('[RecordAddon] 該当期間の該当チャンネルの記録データがありません。');
      return null;
    }
    if (contexts.some(context => context?.transcription === undefined)) {
      console.info('[RecordAddon] 該当期間の一部が文字起こし処理中です。');
      return null;
    }

    const now = dayjs().tz().format('YYYY/MM/DD');
    const header = `${now} ${start.format('HH:mm')}-${end.format('HH:mm')} <${channel.name}> にて:`;
    const lines = contexts
      .map(context => ({ ...context, transcription: context.transcription.replace(/\n/g, '。') }))
      .map(context => `[${dayjs(context.start).tz().format('HH:mm')}] ${context.userName}「${context.transcription}」`);

    return header + '\n\n' + lines.join('\n');
  }

  /**
   * 指定時間範囲の要約を取得します。
   * @param {VoiceChannel} channel
   * @param {dayjs.Dayjs} start
   * @param {dayjs.Dayjs} end
   * @returns {Promise<string|null>}
   */
  async #summarize(channel, start, end) {
    const transcription = await this.#fetchTranscription(channel, start, end);
    if (!transcription) {
      return null;
    }

    // 時間帯に応じてモデルを切り替える
    let model = 'summarize';
    if (start.hour() >= 17) {
      model = 'summarize-casual';
    }

    const { data } = await axios.post(`${process.env.OPEN_WEBUI_HOST}/api/chat/completions`,
      {
        model: model,
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

    console.log(`[RecordAddon] OpenAIトークン消費<${model}>:`, data.usage);

    const now = dayjs().tz().format('YYYY/MM/DD');
    const header = `${now} ${start.format('HH:mm')}-${end.format('HH:mm')} <${channel.name}> にて:`;
    const summary = data.choices[0]?.message?.content ?? '(要約できませんでした)';

    return header + '\n\n' + summary.replace(/\*/g, '');
  }

  /**
   * 期限切れのコンテキストを一括削除します。
   * @param {string} guildId
   * @returns {Promiose<void>}
   */
  async #clean(guildId) {
    // 対象取得
    const limit = dayjs().tz().subtract(this.settings[guildId]?.expires ?? DEFAULT_EXPIRES, 'second');
    const contextIds = await this.#redisClient.zRangeByScore(`${process.env.REDIS_NAMESPACE}:contexts`, 0, limit.valueOf());
    if (!contextIds.length) {
      console.info(`[RecordAddon] 有効期限切れのコンテキストはありません。`);
      return;
    }

    // 一括削除
    const multi = this.#redisClient.multi();
    for (const contextId of contextIds) {
      multi.del(`${process.env.REDIS_NAMESPACE}:context:${contextId}`);
    }
    multi.zRemRangeByScore(`${process.env.REDIS_NAMESPACE}:contexts`, 0, limit.valueOf());
    await multi.exec();

    console.info(`[RecordAddon] 有効期限切れのコンテキスト: ${contextIds.length}件 を削除しました。`);
  }

  /**
   * ボイスチャンネルに参加していないクライアントを返します。
   * @returns {Client}
   */
  static #poolClient() {
    for (const client of RecordAddon.#clients) {
      if (!Object.keys(RecordAddon.#connections).includes(client.user.id)) {
        return client;
      }
    }
    return null;
  }

  /**
   * Botに任意の文字列を発話させます。
   * @param {VoiceConnection} connection
   * @param {string} text
   * @return {Promise<void>}
   */
  async #speak(connection, text) {
    // 文字列 → 音声
    const { data: mp3 } = await axios.post(`${process.env.OPENAI_API_HOST}/v1/audio/speech`,
      {
        model: 'tts-1',
        voice: 'nova',
        respose_format: 'mp3',
        input: text,
        speed: 0.9,
      },
      {
        responseType: 'stream',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // 発話
    const player = createAudioPlayer();
    connection.subscribe(player);
    player.play(createAudioResource(mp3));
  }
}

module.exports = RecordAddon;
