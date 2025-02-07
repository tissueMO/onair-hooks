const Addon = require('./Addon');
const fs = require('fs').promises;
const path = require('path');
const { chunkArray } = require('../common');
const { Guild, Client, ChannelType, ApplicationCommandOptionType, CommandInteraction } = require('discord.js');

const SHUFFLE_FILE = path.join(process.env.STORE_PATH, 'shuffle.json');
const SHUFFLE_CHANNEL_COUNT = 5;

/**
 * 任意のボイスチャンネルに参加しているユーザーをシャッフルします。
 */
class ShuffleAddon extends Addon {
  /**
   * (サーバー別) シャッフル対象チャンネル一覧
   * @type Object<string, VoiceChannel[]>
   */
  static #channels = {};

  /**
   * @override
   */
  get configKey() {
    return 'shuffles';
  }

  /**
   * @override
   */
  get commandDefinitions() {
    return [
      {
        name: 'shuffle',
        description: 'ボイスチャンネルに参加しているメンバーを対象にシャッフルします。',
      },
      {
        name: 'shuffle-list',
        description: 'シャッフル対象のボイスチャンネルを列挙します。',
      },
      {
        name: 'shuffle-set',
        description: 'シャッフル対象のボイスチャンネルを設定します。',
        options: [...Array(SHUFFLE_CHANNEL_COUNT)]
          .map((_, n) => ({
            name: `channel${n + 1}`,
            description: `ボイスチャンネル${n + 1}`,
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          })),
      },
    ];
  }

  /**
   * @override
   */
  get commandHandlers() {
    return {
      /**
       * ボイスチャンネルに参加しているメンバーを対象にシャッフルします。
       * @param {Guild} guild
       * @param {CommandInteraction} interaction
       * @returns {Promise<void>}
       */
      shuffle: async (guild, interaction) => {
        console.info(`[${this.constructor.name}] <${guild.name}> コマンド: シャッフル`);

        await interaction.reply({ content: 'シャッフルしました。' });
        await this.#shuffle(guild);

        return null;
      },

      /**
       * シャッフル対象のボイスチャンネルを列挙します。
       * @param {Guild} guild
       * @param {CommandInteraction} interaction
       * @returns {Promise<Object>}
       */
      'shuffle-list': async (guild, interaction) => {
        console.info(`[${this.constructor.name}] <${guild.name}> コマンド: シャッフル一覧`);
        return `シャッフル対象のチャンネル: ${ShuffleAddon.#channels[guild.id]?.join(', ') ?? '(なし)'}`;
      },

      /**
       * シャッフル対象のボイスチャンネルを設定します。
       * @param {Guild} guild
       * @param {CommandInteraction} interaction
       * @returns {Promise<Object>}
       */
      'shuffle-set': async (guild, interaction) => {
        console.info(`[${this.constructor.name}] <${guild.name}> コマンド: シャッフル設定`);

        ShuffleAddon.#channels[guild.id] = [...Array(SHUFFLE_CHANNEL_COUNT)]
          .map((_, i) => interaction.options.getChannel(`channel${i + 1}`))
          .filter(c => c !== null);

        ShuffleAddon.#saveConfig();

        return 'OK';
      },
    };
  }

  /**
   * @override
   */
  register(client) {
    super.register(client);

    ShuffleAddon.#loadConfig(client);
  }

  /**
   * 保存済みのシャッフル設定をロードします。
   * @param {Client} client
   * @returns {Promise<void>}
   */
  static async #loadConfig(client) {
    ShuffleAddon.#channels = {};

    // 設定ファイルから読み込み
    let data;
    try {
      data = Array.from(JSON.parse(await fs.readFile(SHUFFLE_FILE)));
    } catch {
      return;
    }

    // チャンネルID→チャンネル実体
    for (const { guildId, channels } of data) {
      ShuffleAddon.#channels[guildId] = await Promise.all(channels.map(id => client.channels.fetch(id)));
    }
  }

  /**
   * シャッフル設定を保存します。
   * @returns {Promise<void>}
   */
  static async #saveConfig() {
    // チャンネル実体→チャンネルID
    const data = Object.entries(ShuffleAddon.#channels)
      .map(([guildId, channels]) => ({ guildId, channels: channels.map(c => c.id) }))

    // 設定ファイルに書き込み
    await fs.writeFile(SHUFFLE_FILE, JSON.stringify(data));
  }

  /**
   * シャッフルを実行します。
   * @param {Guild} guild
   */
  async #shuffle(guild) {
    const channels = ShuffleAddon.#channels[guild.id] ?? [];

    // 対象ユーザーでシャッフル
    const members = channels
      .filter(c => !!c)
      .map(c => [...c.members.values()])
      .flat()
      .filter(m => !m.user.bot)
      .sort(() => Math.random() - 0.5);

    // チャンネル割り振り
    const groups = chunkArray(members, Math.ceil(members.length / channels.length));
    groups.forEach((g, i) => {
      console.log(`[${this.constructor.name}] <${guild.name}> シャッフル結果(${i + 1}): ${g.map(m => m.user.username).join(', ')}`);
    });

    // チャンネル移動
    await Promise.allSettled(
      groups
        .map((g, i) => g.map((m) => m.voice.setChannel(channels[i])))
        .flat()
    );
  }
}

module.exports = ShuffleAddon;
