const { Client, Guild } = require('discord.js');
const config = require('../config');

/**
 * アドオン基底クラス
 */
class Addon {
  #settings;
  #guilds;

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
}

module.exports = Addon;
