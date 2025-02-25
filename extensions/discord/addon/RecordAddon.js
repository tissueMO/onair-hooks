const { Client, Guild, VoiceChannel, ChannelType, ApplicationCommandOptionType, GuildScheduledEventStatus, VoiceState, CommandInteraction, GuildScheduledEvent } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType, VoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const Addon = require('./Addon');
const { createWriteStream, createReadStream } = require('fs');
const { pipeline } = require('stream/promises');
const { v4: uuid } = require('uuid');
const fs = require('fs').promises;
const prism = require('prism-media');
const { createRedisClient, parseTime } = require('../common');
const { RedisClientType } = require('@redis/client');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const { default: axios } = require('axios');
const { setTimeout } = require('timers/promises');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

const s3 = new S3Client();
const EXPIRES = 43200;

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
  #redis;

  /**
   * @type {Object}
   */
  #contexts;

  /**
   * @override
   */
  get configKey() {
    return 'records';
  }

  /**
   * @override
   */
  get commandDefinitions() {
    return [
      {
        name: 'record',
        description: 'ボイスチャンネルに議事録要約Botを参加させます。',
        options: [
          {
            name: 'channel',
            description: '参加チャンネル',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          },
        ],
      },
      {
        name: 'transcribe',
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
        name: 'summarize',
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
          {
            name: 'type',
            description: '要約タイプ (official or casual)',
            type: ApplicationCommandOptionType.String,
            minLength: 1,
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
          },
        ],
      },
    ];
  }

  /**
   * @override
   */
  get commandHandlers() {
    return {
      /**
       * ボイスチャンネルに議事録要約Botを参加させます。
       * チャンネルの指定がないときは呼び出したユーザーが参加しているボイスチャンネルに入ります。
       * @param {Guild} guild
       * @param {CommandInteraction} interaction
       * @returns {Promise<string>}
       */
      record: async (guild, interaction) => {
        console.info(`[${this.constructor.name}] <${guild.name}> コマンド: 記録開始`);

        // パラメーター解析
        const channel = interaction.options.getChannel('channel') ?? interaction.member.voice?.channel;

        // 記録開始
        try {
          await this.#startRecord(guild, channel);
          return 'OK';
        } catch (err) {
          return err.message;
        }
      },

      /**
       * 指定したチャンネルの時間範囲における文字起こしを取得します。
       * @param {Guild} guild
       * @param {CommandInteraction} interaction
       * @returns {Promise<null>}
       */
      transcribe: async (guild, interaction) => {
        console.info(`[${this.constructor.name}] <${guild.name}> コマンド: 文字起こし`);

        // 応答遅延
        await interaction.deferReply({ ephemeral: true });

        // パラメーター解析
        const channel = interaction.options.getChannel('channel');
        const start = parseTime(interaction.options.getString('start'));
        const end = parseTime(interaction.options.getString('end'));

        if (!start || !end) {
          await interaction.editReply('時刻は HH:mm 形式で入力してください。');
          return null;
        }

        // 文字起こし取得
        const transcription = await this.#fetchTranscription(channel, start, end);
        if (!transcription) {
          await interaction.editReply('該当期間の記録データがありません。');
          return null;
        }

        // 添付ファイルとして呼出元チャンネルに送信
        const fileName = `/tmp/${dayjs().tz().format('YYYYMMDD')}_${start.format('HHmm')}-${end.format('HHmm')}_${channel.name}.log`;
        await fs.writeFile(fileName, transcription, { encoding: 'utf8' });
        await interaction.channel.send({ files: [fileName] });
        await fs.unlink(fileName);

        await interaction.editReply('OK');
        return null;
      },

      /**
       * 指定したチャンネルの時間範囲における要約を取得します。
       * @param {Guild} guild
       * @param {CommandInteraction} interaction
       * @returns {Promise<null>}
       */
      summarize: async (guild, interaction) => {
        console.info(`[${this.constructor.name}] <${guild.name}> コマンド: 要約`);

        // 応答遅延
        await interaction.deferReply({ ephemeral: true });

        // パラメーター解析
        const channel = interaction.options.getChannel('channel');
        const start = parseTime(interaction.options.getString('start'));
        const end = parseTime(interaction.options.getString('end'));
        const type = interaction.options.getString('type') ?? this.#getSetting(guild.id, 'defaultSummaryType');

        if (!start || !end) {
          await interaction.editReply('時刻は HH:mm 形式で入力してください。');
          return null;
        }

        // 要約取得
        const summary = await this.#summarize(channel, start, end, type);
        if (!summary) {
          await interaction.editReply('該当期間の記録データがありません。');
          return null;
        }

        // 呼出元チャンネルに送信
        await interaction.channel.send(summary);
        await interaction.editReply('OK');

        return null;
      },

      /**
       * 参加中のボイスチャンネル上で任意の文章を発話させます。
       * @param {Guild} guild
       * @param {CommandInteraction} interaction
       * @returns {Promise<string|null>}
       */
      speak: async (guild, interaction) => {
        console.info(`[${this.constructor.name}] <${guild.name}> コマンド: 発話`);

        // パラメーター解析
        const text = interaction.options.getString('text');
        const channel = interaction.options.getChannel('channel') ?? interaction.member.voice?.channel;
        if (!channel) {
          return 'ボイスチャンネルに参加させてから呼び出してください。';
        }

        // Bot取得
        const botId = channel.members.filter(member => member.user.bot).at(0)?.user?.id;
        if (!botId) {
          return '対象となるBotがいません。';
        }

        // 先行応答
        await interaction.reply({ content: 'OK', ephemeral: true });

        // 発話
        const connection = RecordAddon.#connections[botId];
        await this.#speak(guild, connection, text);

        return null;
      },
    };
  }

  /**
   * @override
   */
  get events() {
    return [
      // ボイスチャンネルの入退出に連動してスケジュールイベントを開始・終了させる
      // ※ユーザーが作成したイベントを操作するにはイベントの管理権限が必要
      {
        name: 'voiceStateUpdate',
        handler: async (/** @type {VoiceState} */ oldState, /** @type {VoiceState} */ newState) => {
          const guild = oldState.guild;
          if (!this.isHandle(guild)) {
            return;
          }

          const userId = newState.id;
          const botId = this.client.user.id;

          // Botが退出したらボイスチャンネルの接続を破棄
          if (userId === botId && oldState.channelId !== null && newState.channelId === null) {
            RecordAddon.#connections[botId]?.destroy();
            delete RecordAddon.#connections[botId];
          }

          if (this.isPrimary) {
            // 対象イベントを特定
            const events = [...(
              await guild.scheduledEvents.fetch()
                .then(events => events
                  .filter(event =>
                    event.description.startsWith('@record') &&
                    (
                      (event.status === GuildScheduledEventStatus.Active) ||
                      (
                        0 <= dayjs().diff(dayjs(event.scheduledStartAt), 'second') &&
                        dayjs().diff(dayjs(event.scheduledStartAt), 'second') <= this.#getSetting(guild.id, 'autoSummarizeAbortDuration')
                      )
                    )
                  )
                  .values()
                )
            )];

            // スケジュールイベントのチャンネルごとに処理
            for (const event of events) {
              const channel = event.channel;
              const members = channel.members.filter(member => !member.user.bot);

              // 誰かが入ってきたらスケジュールイベントを開始させる
              if (
                newState.channelId === channel.id &&
                oldState.channelId !== newState.channelId &&
                event.status === GuildScheduledEventStatus.Scheduled &&
                members.size > 0
              ) {
                console.info(`[${this.constructor.name}] スケジュールイベント <${channel.name}> ${event.name} を開始します。`);
                await event.setStatus(GuildScheduledEventStatus.Active);
              }

              // 誰もいなくなったらスケジュールイベントを終了させる
              if (
                oldState.channelId === channel.id &&
                oldState.channelId !== newState.channelId &&
                event.status === GuildScheduledEventStatus.Active &&
                members.size === 0
              ) {
                console.info(`[${this.constructor.name}] スケジュールイベント <${channel.name}> ${event.name} を終了します。`);
                await event.setStatus(GuildScheduledEventStatus.Completed);
              }
            }
          }
        },
      },

      // スケジュールイベントの開始と終了に連動してBotを参加・退出させる
      // スケジュールイベント終了時に自動で要約する
      {
        name: 'guildScheduledEventUpdate',
        handler: async (/** @type {GuildScheduledEvent?} */ oldEvent, /** @type {GuildScheduledEvent?} */ newEvent) => {
          const guild = oldEvent?.guild;
          if (!this.isHandle(guild) || !this.isPrimary || !oldEvent?.description?.startsWith('@record')) {
            return;
          }

          // Botを参加させて記録を開始する
          if (
            oldEvent?.status === GuildScheduledEventStatus.Scheduled &&
            newEvent?.status === GuildScheduledEventStatus.Active
          ) {
            console.info(`[${this.constructor.name}] スケジュールイベント <${newEvent.channel.name}> ${newEvent.name} が開始しました。`);
            console.log(`[${this.constructor.name}] スケジュールイベント開始/変更前:`, oldEvent?.status, oldEvent?.channel, oldEvent?.scheduledStartAt, oldEvent?.creatorId, oldEvent?.description);
            console.log(`[${this.constructor.name}] スケジュールイベント開始/変更後:`, newEvent?.status, newEvent?.channel, newEvent?.scheduledStartAt, newEvent?.creatorId, newEvent?.description);

            try {
              await this.#startRecord(guild, newEvent.channel);
            } catch (err) {
              console.warn(`[${this.constructor.name}] スケジュールイベント参加失敗: ${err}`);
            }
          }

          // Botを退出させて記録を終了し、要約を自動生成する
          if (
            oldEvent?.status === GuildScheduledEventStatus.Active &&
            newEvent?.status !== GuildScheduledEventStatus.Active
          ) {
            console.info(`[${this.constructor.name}] スケジュールイベント <${oldEvent.channel.name}> ${oldEvent.name} が終了しました。`);
            console.log(`[${this.constructor.name}] スケジュールイベント終了/変更前:`, oldEvent?.status, oldEvent?.channel, oldEvent?.scheduledStartAt, oldEvent?.creatorId, oldEvent?.description);
            console.log(`[${this.constructor.name}] スケジュールイベント終了/変更後:`, newEvent?.status, newEvent?.channel, newEvent?.scheduledStartAt, newEvent?.creatorId, newEvent?.description);

            try {
              await this.#endRecord(guild, oldEvent.channel);
            } catch (err) {
              console.warn(`[${this.constructor.name}] スケジュールイベント退出失敗: ${err}`);
            }

            // 要約パラメーター
            const start = dayjs(oldEvent.scheduledStartAt).tz();
            const end = dayjs().tz();
            const timeSpan = end.diff(start, 'second');
            const type = oldEvent.description.match(/@record\((.*)\)/)?.[1] ?? this.#getSetting(guild.id, 'defaultSummaryType');
            const defaultChannelId = this.#getSetting(guild.id, 'defaultChannelId');

            console.info(`[${this.constructor.name}] 記録時間: ${start.format('HH:mm')}-${end.format('HH:mm')} (${timeSpan}秒)`);

            if (!defaultChannelId) {
              console.info(`[${this.constructor.name}] 自動要約を行いません。`);
              return;
            }
            if (timeSpan < this.#getSetting(guild.id, 'autoSummarizeMinDuration')) {
              console.info(`[${this.constructor.name}] 記録時間が短すぎるため自動要約をスキップします。`);
              return;
            }

            // 要約実行
            const delay = this.#getSetting(guild.id, 'autoSummarizeDelayTime');
            console.info(`[${this.constructor.name}] ${delay}秒後に要約します。`);
            await setTimeout(delay * 1000);

            const summary = await this.#summarize(oldEvent.channel, start, end, type);
            if (!summary) {
              console.info(`[${this.constructor.name}] 該当期間の記録データがありません。`);
              return;
            }

            // デフォルトチャンネルに送信
            await this.client.channels.cache.get(defaultChannelId).send(summary);
          }
        },
      },
    ];
  }

  /**
   * @override
   */
  async register(client) {
    await super.register(client);

    // 全クライアント共通
    RecordAddon.#connections = {};
    RecordAddon.#clients ??= [];
    if (!RecordAddon.#clients.includes(client)) {
      RecordAddon.#clients.push(client);
    }

    // クライアント別
    this.#contexts = {};
    this.#redis = await createRedisClient();
  }

  /**
   * Botによる音声記録を開始します。
   * @param {Guild} guild
   * @param {VoiceChannel} channel
   * @returns {Promise<void>}
   */
  async #startRecord(guild, channel) {
    await this.#clean();

    if (!channel) {
      console.warn(`[${this.constructor.name}] Bot参加失敗: チャンネル指定なし`);
      throw new Error('ボイスチャンネルに参加してから呼び出すか、チャンネルを指定してください。');
    }
    if (channel.members.filter(member => member.user.bot).size > 0) {
      console.warn(`[${this.constructor.name}] Bot参加失敗: Bot参加済み`);
      throw new Error('Botは既に参加しています。');
    }

    // アイドルクライアント取得
    const targetClient = RecordAddon.#poolClient();
    if (!targetClient) {
      console.warn(`[${this.constructor.name}] Bot参加失敗: Botプール不足`);
      throw new Error('ボイスチャンネルに参加できるBotがいません。');
    }

    // Botをボイスチャンネルに参加させる
    const botId = targetClient?.user?.id;
    RecordAddon.#connections[botId]?.destroy();

    const connection = joinVoiceChannel({
      guildId: guild.id,
      channelId: channel.id,
      group: channel.name,
      adapterCreator: targetClient.guilds.cache.get(guild.id).voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false,
    });

    // ユーザーの発話ごとに音声を記録する
    connection.receiver.speaking.on('start', async userId => {
      const userName = guild.members.cache.get(userId).displayName;
      const userShortName = userName.replace(/　/g, ' ').split(' ')[0];

      if (!this.#contexts[userId]) {
        await this.#capture(connection, {
          contextId: uuid(),
          guildId: guild.id,
          channelId: channel.id,
          userId: userId,
          userName: userName,
          userShortName: userShortName,
          start: dayjs().tz().format(),
        });
      }
    });

    RecordAddon.#connections[botId] = connection;

    console.info(`[${this.constructor.name}] Botが <${channel.name}> に参加しました。`);
  }

  /**
   * Botによる音声記録を終了します。
   * @param {Guild} guild
   * @param {VoiceChannel} channel
   * @returns {Promise<void>}
   */
  async #endRecord(guild, channel) {
    await this.#clean(guild.id);

    if (!channel) {
      console.warn(`[${this.constructor.name}] Bot退出失敗: チャンネル指定なし`);
      throw new Error('ボイスチャンネルに参加してから呼び出すか、チャンネルを指定してください。');
    }

    // Bot取得
    const botId = channel.members.filter(member => member.user.bot).at(0)?.user?.id;
    if (!botId) {
      console.warn(`[${this.constructor.name}] Bot退出失敗: 参加Botなし`);
      throw new Error('対象となるBotがいません。');
    }

    // Bot切断
    RecordAddon.#connections[botId]?.disconnect();
    console.info(`[${this.constructor.name}] Botが <${channel.name}> から退出しました。`);
  }

  /**
   * ユーザーの音声をキャプチャーします。
   * @param {VoiceConnection} connection
   * @param {Object} context
   * @returns {Promise<Object|null>} コンテキスト
   */
  async #capture(connection, context) {
    const { contextId, userId, guildId } = context;
    const baseName = `${contextId}.pcm`;
    const pcmFile = `/tmp/${baseName}`;

    console.info(`[${this.constructor.name}] キャプチャー開始: User<${userId}> Session<${contextId}>`);
    this.#contexts[userId] = context;

    try {
      // キャプチャー実行
      await pipeline(
        connection.receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: this.#getSetting(guildId, 'captureTimeout') * 1000,
          },
        }),
        new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }),
        createWriteStream(pcmFile)
      );

      // キャプチャー終了
      context.end = dayjs().tz().format();

      // ※相槌やノイズのような短い音声は除外する
      const timeSpan = dayjs(context.end).diff(dayjs(context.start), 'second');
      if (timeSpan < this.#getSetting(guildId, 'captureMinDuration')) {
        console.info(`[${this.constructor.name}] キャプチャー中止: User<${userId}> Session<${contextId}>`);
        return null;
      }

      // アップロード (pcm)
      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${process.env.S3_PREFIX}/${process.env.REDIS_NAMESPACE}/${baseName}`,
        Body: createReadStream(pcmFile),
      }));

      // コンテキスト保存
      await this.#redis.multi()
        .setEx(`${process.env.REDIS_NAMESPACE}:context:${contextId}`, EXPIRES, JSON.stringify(context))
        .zAdd(`${process.env.REDIS_NAMESPACE}:contexts`, { score: dayjs(context.start).valueOf(), value: contextId })
        .exec();

      console.info(`[${this.constructor.name}] キャプチャー終了: User<${userId}> Session<${contextId}> --> ${pcmFile}`);
      return context;

    } catch (err) {
      console.error(`[${this.constructor.name}] キャプチャー失敗: User<${userId}> Session<${contextId}>`, err);
      return null;

    } finally {
      await fs.unlink(pcmFile);
      delete this.#contexts[userId];
    }
  }

  /**
   * 指定時間範囲の文字起こしを取得します。
   * @param {VoiceChannel} channel
   * @param {dayjs.Dayjs} start
   * @param {dayjs.Dayjs} end
   * @returns {Promise<string|null>}
   */
  async #fetchTranscription(channel, start, end) {
    // 指定時間範囲のコンテキストを取得
    const contexts = await this.#fetchContexts(channel, start, end);

    if (!contexts.length) {
      console.info(`[${this.constructor.name}] 該当期間の該当チャンネルの記録データがありません。`);
      return null;
    }
    if (contexts.some(context => !context?.transcription)) {
      console.warn(`[${this.constructor.name}] 該当期間の一部が文字起こし処理中ですが続行します。`);
    }

    // 実際の開始と終了の時刻
    const actualStart = dayjs(contexts[0].start).tz();
    const actualEnd = dayjs(contexts[contexts.length - 1].end).tz();

    // フォーマット
    const today = dayjs().tz().format('YYYY/MM/DD');
    const header = `${today} ${actualStart.format('HH:mm')}-${actualEnd.format('HH:mm')} <${channel.name}> にて:`;
    const lines = contexts
      .map(context => ({ ...context, transcription: context.transcription?.replace(/\n/g, '。') }))
      .map(context => `[${dayjs(context.start).tz().format('HH:mm')}] ${context.userShortName}「${context.transcription ?? '(文字起こしできませんでした)'}」`);

    return header + '\n\n' + lines.join('\n');
  }

  /**
   * 指定時間範囲の要約を取得します。
   * @param {VoiceChannel} channel
   * @param {dayjs.Dayjs} start
   * @param {dayjs.Dayjs} end
   * @param {string} type
   * @returns {Promise<string|null>}
   */
  async #summarize(channel, start, end, type) {
    const apiOptions = {
      headers: {
        Authorization: `Bearer ${process.env.OPEN_WEBUI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    // 要約タイプからモデル名を解決
    const modelId = `summarize-${type}`;
    const modelIds = await axios.get(`${process.env.OPEN_WEBUI_HOST}/api/models`, apiOptions)
      .then(({ data }) => data.data.map(model => model.id));

    if (!modelIds.includes(modelId)) {
      console.warn(`[${this.constructor.name}] タイプ <${type}> に対応するモデルがありません。`);
      return '(要約できませんでした: タイプが誤っています)';
    }

    // 文字起こし取得
    const transcription = await this.#fetchTranscription(channel, start, end);
    if (!transcription) {
      return null;
    }

    // 要約生成
    console.info(`[${this.constructor.name}] タイプ <${type}> で要約します...`);
    const { data } = await axios.post(`${process.env.OPEN_WEBUI_HOST}/api/chat/completions`, {
      model: modelId,
      messages: [{ role: 'user', content: transcription }],
    }, apiOptions);

    console.log(`[${this.constructor.name}] OpenAIトークン消費 <${type}>:`, data.usage);

    if (!data.choices[0]?.message?.content) {
      return '(要約できませんでした: 結果を取得できませんでした)';
    }

    // 実際の開始と終了の時刻
    const contexts = await this.#fetchContexts(channel, start, end);
    const actualStart = dayjs(contexts[0].start).tz();
    const actualEnd = dayjs(contexts[contexts.length - 1].end).tz();

    // 参加者リストを作る (参加率順)
    const userNames = await this.#fetchContexts(channel, start, end)
      .then(contexts => contexts
        .map(context => context.userShortName)
        .reduce((names, name) => {
          names[name] = names[name] ? (names[name] + 1) : 1;
          return names;
        }, {})
      )
      .then(names => Object.entries(names)
        .sort(([, aCount], [, bCount]) => bCount - aCount)
        .map(entries => entries[0])
      );

    // フォーマット
    const today = dayjs().tz().format('YYYY/MM/DD');
    const headerText = `${today} ${actualStart.format('HH:mm')}-${actualEnd.format('HH:mm')} <${channel.name}> にて:`;

    return [
      headerText,
      `参加者: ${userNames.join('・')}`,
      data.choices[0].message.content.replace(/\*/g, ''),
    ].join('\n');
  }

  /**
   * Botに任意の文字列を発話させます。
   * @param {VoiceConnection} connection
   * @param {string} text
   * @return {Promise<void>}
   */
  async #speak(guild, connection, text) {
    // 文字列 → 音声
    const { data: mp3 } = await axios.post(`${process.env.OPENAI_API_HOST}/v1/audio/speech`,
      {
        model: this.#getSetting(guild.id, 'speakModel'),
        voice: this.#getSetting(guild.id, 'speakVoice'),
        speed: this.#getSetting(guild.id, 'speakSpeed'),
        input: text,
        respose_format: 'mp3',
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

  /**
   * 期限切れのコンテキストを一括削除します。
   * @returns {Promiose<void>}
   */
  async #clean() {
    // 対象取得
    const limit = dayjs().tz().subtract(EXPIRES, 'second');
    const contextIds = await this.#redis.zRangeByScore(`${process.env.REDIS_NAMESPACE}:contexts`, 0, limit.valueOf());
    if (!contextIds.length) {
      return;
    }

    // 一括削除
    const multi = this.#redis.multi();
    for (const contextId of contextIds) {
      multi.del(`${process.env.REDIS_NAMESPACE}:context:${contextId}`);
    }
    multi.zRemRangeByScore(`${process.env.REDIS_NAMESPACE}:contexts`, 0, limit.valueOf());
    await multi.exec();

    console.info(`[${this.constructor.name}] 有効期限切れのコンテキスト: ${contextIds.length}件 削除しました。`);
  }

  /**
   * 指定時間範囲のコンテキストを取得します。
   * @param {VoiceChannel} channel
   * @param {dayjs.Dayjs} start
   * @param {dayjs.Dayjs} end
   * @returns {Promise<Object[]>}
   */
  async #fetchContexts(channel, start, end) {
    const contextIds = await this.#redis.zRangeByScore(`${process.env.REDIS_NAMESPACE}:contexts`, start.valueOf(), end.valueOf());
    if (!contextIds.length) {
      return [];
    }

    return await this.#redis.mGet(contextIds.map(id => `${process.env.REDIS_NAMESPACE}:context:${id}`))
      .then(contexts => contexts.map(context => context ? JSON.parse(context) : null))
      .then(contexts => contexts.filter(context => context?.channelId === channel.id))
  }

  /**
   * 任意の設定値を取得します。
   * @param {string} guildId
   * @param {string} key
   * @returns {*}
   */
  #getSetting(guildId, key) {
    const settings = this.settings[guildId]?.[0] ?? {};

    const defaultSettings = {
      defaultSummaryType: 'official',
      autoSummarizeAbortDuration: 30 * 60,
      autoSummarizeDelayTime: 30,
      autoSummarizeMinDuration: 10 * 60,
      captureTimeout: 1,
      captureMinDuration: 3,
      speakSpeed: 0.9,
      speakModel: 'tts-1',
      speakVoice: 'nova',
    };

    return settings[key] ?? defaultSettings[key];
  }

  /**
   * ボイスチャンネルに参加していないクライアントを1つ返します。
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
}

module.exports = RecordAddon;
