const { Client, Guild, ApplicationCommandDataResolvable, CommandInteraction, InteractionReplyOptions } = require('discord.js');
const config = require('../config');

/**
 * アドオン基底クラス
 */
class Addon {
  #settings;
  #guilds;
  #commands;

  /**
   * コンフィグキーを返します。
   * @returns {string}
   */
  get configKey() {
    return '';
  }

  /**
   * サーバー別の設定一覧を返します。
   * @returns {Object}
   */
  get settings() {
    return this.#settings;
  }

  /**
   * Discordサーバー情報を返します。
   * @returns {Object<string, Guild>}
   */
  get guilds() {
    return this.#guilds;
  }

  /**
   * クライアントにこのアドオンを登録します。
   * @param {Client} client
   */
  register(client) {
    client.once('ready', async () => {
      const guildIds = [...client.guilds.cache.keys()];

      this.#guilds = guildIds.reduce((guilds, guildId) => {
        guilds[guildId] = client.guilds.cache.get(guildId);
        return guilds;
      }, {});

      this.#settings = guildIds.reduce((settings, guildId) => {
        settings[guildId] = config[this.configKey]?.filter(f => f.guildId === guildId) ?? []
        return settings;
      }, {});

      // コマンドハンドリング
      this.#commands = {};
      client.on('interactionCreate', async (/** @type {CommandInteraction} */ interaction) => {
        if (interaction.isCommand()) {
          const guild = client.guilds.cache.get(interaction.guildId);
          const reaction = await this.#commands[interaction.commandName]?.(client, guild, interaction);
          if (reaction) {
            await interaction.reply(reaction);
          }
        }
      });

      // 初期化
      await Promise.all(guildIds.map(guildId => this.initialize(client, this.#guilds[guildId])));
    });
  }

  /**
   * クライアントが利用可能な状態になったときに一度だけ実行します。
   * @param {Client} client
   * @param {Guild} guild
   */
  async initialize(client, guild) {
  }

  /**
   * コマンドを登録します。
   * @param {Client} client
   * @param {Guild} guild
   * @param {ApplicationCommandDataResolvable} command
   * @param {function(Client, Guild, CommandInteraction): Promise<InteractionReplyOptions?>} callback
   * @return {Promise<void>}
   */
  async addCommand(client, guild, command, callback) {
    this.#commands[command.name] = callback;
    await client.application.commands.create(command, guild.id);
  }
}

module.exports = Addon;
