const { Client, Guild, VoiceChannel, ChannelType, ApplicationCommandOptionType, GuildScheduledEventStatus, BaseInteraction } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType, VoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
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
const { CronJob } = require('cron');

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

      // スラッシュコマンドを追加 ※一部先発クライアントが後発クライアントを操作するケースあり
      if (!this.settings[guild.id].length) {
        console.info(`[RecordAddon] <${guild.name}> このサーバーでは無効です。`);
        return;
      }

      await this.addCommand(client, guild,
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
              name: 'type',
              description: '自動生成する要約のタイプ名 (official or casual)',
              type: ApplicationCommandOptionType.String,
              minLength: 1,
            },
            {
              name: 'channel',
              description: '参加チャンネル',
              type: ApplicationCommandOptionType.Channel,
              channelTypes: [ChannelType.GuildVoice],
            },
          ],
        },
        async (client, guild, interaction) => {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 記録開始`);

          /** @type {VoiceChannel} 呼び出したユーザーが参加しているボイスチャンネル */
          const channel = interaction.options.getChannel('channel') ?? interaction.member.voice?.channel;

          const silent = interaction.options.getBoolean('silent');
          const type = interaction.options.getString('type') ?? 'official';

          return await this.#startRecord(guild, channel, {
            enabled: !silent,
            type: type,
          });
        }
      );

      await this.addCommand(client, guild,
        {
          name: 'record-end',
          description: 'ボイスチャンネルから議事録要約Botを退出させます。',
          options: [
            {
              name: 'channel',
              description: '参加チャンネル',
              type: ApplicationCommandOptionType.Channel,
              channelTypes: [ChannelType.GuildVoice],
            },
          ],
        },
        async (client, guild, interaction) => {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 記録終了`);

          /** @type {VoiceChannel} 呼び出したユーザーが参加しているボイスチャンネル */
          const channel = interaction.options.getChannel('channel') ?? interaction.member.voice?.channel;

          return await this.#endRecord(guild, channel);
        }
      );

      await this.addCommand(client, guild,
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
        async (client, guild, interaction) => {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 文字起こし`);

          const start = parseTime(interaction.options.getString('start'));
          const end = parseTime(interaction.options.getString('end'));

          /** @type VoiceChannel */
          const targetChannel = interaction.options.getChannel('channel');

          if (!start || !end) {
            return {
              content: '時刻は HH:mm 形式で入力してください。',
              ephemeral: true,
            };
          }

          await interaction.deferReply({ ephemeral: true });

          const transcription = await this.#fetchTranscription(targetChannel, start, end);

          // 添付ファイルとして送信
          if (transcription) {
            const now = dayjs().tz();
            const fileName = `/tmp/${now.format('YYYYMMDD')}_${start.format('HHmm')}-${end.format('HHmm')}_${targetChannel.name}.log`;

            await fs.writeFile(fileName, transcription, { encoding: 'utf8' });
            await interaction.channel.send({ files: [fileName] });
            await fs.unlink(fileName);

            await interaction.editReply('OK');
          } else {
            await interaction.editReply('該当期間の記録データがありません。');
          }

          return null;
        }
      );

      await this.addCommand(client, guild,
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
            {
              name: 'type',
              description: 'タイプ名 (official or casual)',
              type: ApplicationCommandOptionType.String,
              minLength: 1,
            },
          ],
        },
        async (client, guild, interaction) => {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 要約`);

          const start = parseTime(interaction.options.getString('start'));
          const end = parseTime(interaction.options.getString('end'));
          const targetChannel = interaction.options.getChannel('channel');
          const type = interaction.options.getString('type') ?? 'official';

          if (!start || !end) {
            return {
              content: '時刻は HH:mm 形式で入力してください。',
              ephemeral: true,
            };
          }

          await interaction.deferReply({ ephemeral: true });

          const summary = await this.#summarize(targetChannel, start, end, type);

          if (summary) {
            await interaction.channel.send(summary);
            await interaction.editReply('OK');
          } else {
            await interaction.editReply('該当期間の記録データがありません。');
          }
        }
      );

      await this.addCommand(client, guild,
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
        async (client, guild, interaction) => {
          console.info(`[RecordAddon] <${guild.name}> コマンド: 発話`);

          /** @type {VoiceChannel} 呼び出したユーザーが参加しているボイスチャンネル */
          const channel = interaction.options.getChannel('channel') ?? interaction.member.voice?.channel;
          if (!channel) {
            return {
              content: 'ボイスチャンネルに参加させてから呼び出してください。',
              ephemeral: true,
            };
          }

          // Bot取得
          const botId = channel.members.filter(member => member.user.bot).at(0)?.user?.id;
          if (!botId) {
            return {
              content: '対象となるBotがいません。',
              ephemeral: true,
            };
          }

          await interaction.reply({
            content: 'OK',
            ephemeral: true,
          });

          // 発話
          await this.#speak(RecordAddon.#connections[botId]?.connection, interaction.options.getString('text'))

          return null;
        }
      );

      // スケジュール監視
      CronJob.from({
        cronTime: '0 * * * * *',
        start: true,
        timeZone: 'Asia/Tokyo',
        onTick: async () => {
          const events = [...(
            (await guild.scheduledEvents.fetch())
              .filter(event =>
                (event.status === GuildScheduledEventStatus.Scheduled || event.status === GuildScheduledEventStatus.Active)
                  && dayjs(event.scheduledStartAt).format('YYYYMMDDHHmm') === dayjs().format('YYYYMMDDHHmm')
                  && event.description.includes('@record')
              )
              .values()
          )];

          // 記録開始
          for (const event of events) {
            console.info(`[RecordAddon] スケジュール参加: ${event.channel.name}`);

            const type = event.description.match(/@record\((.*)\)/)?.[1] ?? 'official';

            await this.#startRecord(guild, event.channel, {
              enabled: true,
              type: type,
            });

            await setTimeout(3000);
          }

          // 一定時間経っても誰もいなければ中止する
          await setTimeout(30 * 60 * 1000);

          for (const event of events) {
            const members = event.channel.members;
            const onlyBot = members.filter(member => member.user.bot).size > 0 && members.filter(member => !member.user.bot).size === 0;
            if (onlyBot) {
              console.info(`[RecordAddon] スケジュール参加しましたが、参加者がいないため中止します: ${event.channel.name}`);
              await this.#endRecord(guild, event.channel);
          } else {
              console.info(`[RecordAddon] スケジュール参加継続: ${event.channel.name}`);
            }
          }
        },
      });

      console.info(`[RecordAddon] <${guild.name}> コマンドを登録しました。`);
    }

    // ボイスチャンネルの退出を監視
    client.on('voiceStateUpdate', async (oldState, newState) => {
      const botId = client.user.id;
      const botChannel = oldState.guild.channels.cache.find(channel => channel.type === ChannelType.GuildVoice && channel.members.has(botId));

      // 誰もいなくなったら退出する
      if (botChannel && oldState.channelId === botChannel.id && oldState.channelId !== newState.channelId) {
        const members = botChannel.members.filter(member => !member.user.bot);

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
        const timeSpan = end.diff(start, 'minute');
        const autoSummary = connection.autoSummary;

        connection.connection.destroy();
        delete RecordAddon.#connections[botId];

        const previousChannel = await oldState.guild.channels.fetch(oldState.channelId);
        console.info(`[RecordAddon] Botが <${previousChannel.name}> から退出しました。`);

        // 一定時間後にデフォルトチャンネル宛に要約を貼る
        if (autoSummary.enabled && timeSpan >= 10 && process.env.DEFAULT_CHANNEL_ID) {
          console.info(`[RecordAddon] 30秒後に要約します。`);
          await setTimeout(30000);

          const summary = await this.#summarize(previousChannel, start, end, autoSummary.type);

          if (summary) {
            await client.channels.cache.get(process.env.DEFAULT_CHANNEL_ID).send(summary);
          } else {
            console.info(`[RecordAddon] 該当期間の記録データがありません。`);
          }

        } else if (autoSummary.enabled && timeSpan < 10) {
          console.info(`[RecordAddon] 記録時間が短すぎるため要約をスキップします。`);
        }
      }
    });
  }

  /**
   * Botによる音声記録を開始します。
   * @param {Guild} guild
   * @param {VoiceChannel} channel
   * @param {Object} summaryOption
   * @returns {Promise<Object>} 返信内容
   */
  async #startRecord(guild, channel, summaryOptions = {enabled: true, type: 'official'}) {
    await this.#clean(guild.id);

    if (!channel) {
      console.warn(`[RecordAddon] Bot参加失敗: チャンネル指定なし`);
      return {
        content: 'ボイスチャンネルに参加してから呼び出すか、チャンネルを指定してください。',
        ephemeral: true,
      };
    }

    const joined = channel.members.filter(member => member.user.bot).size > 0;
    if (joined) {
      console.warn(`[RecordAddon] Bot参加失敗: Bot参加済み`);
      return {
        content: 'Botは既に参加しています。',
        ephemeral: true,
      };
    }

    // アイドルクライアント取得
    const targetClient = RecordAddon.#poolClient();
    const botId = targetClient?.user?.id;

    if (!targetClient) {
      console.warn(`[RecordAddon] Bot参加失敗: Botプール不足`);
      return {
        content: 'ボイスチャンネルに参加できるBotがいません。',
        ephemeral: true,
      };
    }

    RecordAddon.#connections[botId]?.connection?.destroy();

    // Botをボイスチャンネルに参加させる
    const connection = joinVoiceChannel({
      guildId: guild.id,
      channelId: channel.id,
      group: channel.name,
      adapterCreator: targetClient.guilds.cache.get(guild.id).voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false,
    });

    // ユーザーの発話ごとに音声を記録する
    connection.receiver.speaking.on('start', async (userId) => {
      const userName = guild.members.cache.get(userId).displayName;

      if (!this.#contexts[userId]) {
        await Promise.resolve()
          .then(() => this.#capture(connection, {
            contextId: uuid(),
            guildId: guild.id,
            channelId: channel.id,
            userId,
            userName: userName,
            userShortName: userName.replace(/　/g, ' ').split(' ')[0],
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
      autoSummary: summaryOptions,
    };

    console.info(`[RecordAddon] Botが <${channel.name}> に参加しました。`);

    return {
      content: `${channel} に参加しました。`,
      ephemeral: true,
    };
  }

  /**
   * Botによる音声記録を終了します。
   * @param {Guild} guild
   * @param {VoiceChannel} channel
   * @returns {Object} 返信内容
   */
  async #endRecord(guild, channel) {
    await this.#clean(guild.id);

    if (!channel) {
      console.warn(`[RecordAddon] Bot退出失敗: チャンネル指定なし`);
      return {
        content: 'ボイスチャンネルに参加してから呼び出すか、チャンネルを指定してください。',
        ephemeral: true,
      };
    }

    // Bot取得
    const botId = channel.members.filter(member => member.user.bot).at(0)?.user?.id;
    if (!botId) {
      console.warn(`[RecordAddon] Bot退出失敗: 参加Botなし`);
      return {
        content: '対象となるBotがいません。',
        ephemeral: true,
      };
    }

    // Bot切断
    RecordAddon.#connections[botId]?.connection?.disconnect();

    return {
      content: 'OK',
      ephemeral: true,
    };
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
      .map(context => `[${dayjs(context.start).tz().format('HH:mm')}] ${context.userShortName}「${context.transcription}」`);

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
    const now = dayjs().tz().format('YYYY/MM/DD');
    const headerText = `${now} ${start.format('HH:mm')}-${end.format('HH:mm')} <${channel.name}> にて:`;
    const apiOptions = {
      headers: {
        Authorization: `Bearer ${process.env.OPEN_WEBUI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    // モデル名バリデーション
    const modelId = `summarize-${type}`;
    const modelIds = await axios.get(`${process.env.OPEN_WEBUI_HOST}/api/models`, apiOptions)
      .then(({ data }) => data.data.map(model => model.id));

    if (!modelIds.includes(modelId)) {
      console.warn(`[RecordAddon] タイプ <${type}> に該当するモデルがありません。`);
      return [headerText, '(要約できませんでした: タイプが誤っています)'].join('\n');
    }

    // 文字起こし取得
    const transcription = await this.#fetchTranscription(channel, start, end);
    if (!transcription) {
      return [headerText, '(要約できませんでした: 該当期間の記録がありません)'].join('\n');
    }

    // サマリー生成
    console.info(`[RecordAddon] タイプ <${type}> で要約します...`);
    const { data } = await axios.post(`${process.env.OPEN_WEBUI_HOST}/api/chat/completions`, {
      model: modelId,
      messages: [
        {
          role: 'user',
          content: transcription,
        },
      ],
    }, apiOptions);

    console.log(`[RecordAddon] OpenAIトークン消費 <${type}>:`, data.usage);

    // 参加者リストを作る (参加率順)
    const contextIds = await this.#redisClient.zRangeByScore(`${process.env.REDIS_NAMESPACE}:contexts`, start.valueOf(), end.valueOf());
    const userNames = await this.#redisClient.mGet(contextIds.map(id => `${process.env.REDIS_NAMESPACE}:context:${id}`))
      .then(contexts => contexts.map(context => context ? JSON.parse(context) : null))
      .then(contexts => contexts.filter(context => context?.channelId === channel.id))
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
    return [
      headerText,
      `参加者: ${userNames.join('・')}`,
      (data.choices[0]?.message?.content ?? '(要約できませんでした)').replace(/\*/g, ''),
    ].join('\n');
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
