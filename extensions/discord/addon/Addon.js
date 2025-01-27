const { Guild } = require('discord.js');
const { CronJob } = require('cron');

/**
 * アドオン基底クラス
 */
class Addon {
  /**
   * @type {Client}
   */
  #client;

  /**
   * @type {Object}
   */
  #settings;

  /**
   * @type {Object<string, Guild>}
   */
  #guilds;

  /**
   * @type {boolean}
   */
  #isPrimary;

  /**
   * Discordクライアント
   * @returns {Client}
   */
  get client() {
    return this.#client;
  }

  /**
   * サーバー別設定
   * @returns {Object}
   */
  get settings() {
    return this.#settings;
  }

  /**
   * Discordサーバー情報
   * @returns {Object<string, Guild>}
   */
  get guilds() {
    return this.#guilds;
  }

  /**
   * プライマリークライアントかどうか
   * @returns {boolean}
   */
  get isPrimary() {
    return this.#isPrimary;
  }

  /**
   * コンフィグキー
   * @returns {string}
   */
  get configKey() {
    return '';
  }

  /**
   * コマンド定義
   * ※プライマリークライアントのみ有効
   * @returns {Object[]}
   */
  get commandDefinitions() {
    return [];
  }

  /**
   * コマンドに対応するハンドラー定義
   * ※プライマリークライアントのみ有効
   * @returns {Object<string, function(Client, Guild, CommandInteraction): Promise<InteractionReplyOptions?>>[]}
   */
  get commandHandlers() {
    return [];
  }

  /**
   * スケジュールハンドラー定義
   * ※プライマリークライアントのみ有効
   * @returns {Object[]}
   */
  get scheduleHandlers() {
    return [];
  }

  /**
   * イベントリスナー定義
   * @returns {Object[]}
   */
  get events() {
    return [];
  }

  /**
   * Discordクライアントにこのアドオンを登録します。
   * @param {Client} client
   */
  register(client) {
    client.once('ready', async () => {
      this.#isPrimary = (client.user.id === process.env.PRIMARY_BOT_ID);
      const guildIds = [...client.guilds.cache.keys()];

      // サーバーごとに初期化
      this.#guilds = guildIds.reduce((guilds, guildId) => {
        guilds[guildId] = client.guilds.cache.get(guildId);
        return guilds;
      }, {});

      this.#settings = guildIds.reduce((settings, guildId) => {
        settings[guildId] = config[this.configKey]?.filter(f => f.guildId === guildId) ?? [];
        return settings;
      }, {});

      await Promise.all(guildIds
        .map(guildId => this.#guilds[guildId])
        .filter(guild => this.isHandle(guild))
        .map(guild => this.initialize(guild))
      );

      // イベント登録
      for (const event of this.events) {
        client.on(event.name, async (...args) => event.handler(...args))
      }
    });

    this.#client = client;
  }

  /**
   * Discordサーバーごとの初期化を行います。
   * @param {Guild} guild
   * @returns {void}
   */
  async initialize(guild) {
    // ※プライマリークライアントのみ有効
    if (!this.isPrimary) {
      return;
    }

    // コマンド登録
    for (const command of this.commandDefinitions) {
      await this.client.application.commands.create(command, guild.id);

      this.client.on('interactionCreate', async (/** @type {CommandInteraction} */ interaction) => {
        if (interaction.isCommand() && interaction.commandName === command.name) {
          const guild = this.client.guilds.cache.get(interaction.guildId);
          const reply = await this.commandHandlers[interaction.commandName]?.(guild, interaction);
          if (reply) {
            await interaction.reply({ content: reply, ephemeral: true });
          }
        }
      });
    }

    // スケジュール監視
    CronJob.from({
      cronTime: '0 * * * * *',
      start: true,
      timeZone: 'Asia/Tokyo',
      onTick: async () => {
        const events = [...(
          await guild.scheduledEvents.fetch()
            .then(events => events
              .filter(event =>
                (event.status === GuildScheduledEventStatus.Scheduled || event.status === GuildScheduledEventStatus.Active)
                  && dayjs(event.scheduledStartAt).format('YYYYMMDDHHmm') === dayjs().format('YYYYMMDDHHmm')
              )
              .values()
            )
        )];

        for (const handler of this.scheduleHandlers) {
          const handleEvents = events.filter(event => handler.isHandle(event));
          if (handleEvents.length > 0) {
            await handler.handle(guild, handleEvents);
          }
        }
      },
    });
  }

  /**
   * 対象のDiscordサーバーを処理するかどうかを返します。
   * @param {Guild?} guild
   * @returns {boolean}
   */
  isHandle(guild) {
    return guild && this.#settings[guild.id].length > 0;
  }
}

module.exports = Addon;
