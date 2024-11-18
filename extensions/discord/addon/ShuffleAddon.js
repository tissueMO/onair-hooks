const Addon = require('./Addon');
const fs = require('fs').promises;
const path = require('path');
const { chunkArray } = require('../common');
const { Guild, Client, ChannelType, ApplicationCommandOptionType } = require('discord.js');

const SHUFFLE_FILE = path.join(process.env.STORE_PATH, 'shuffle.json');

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
   * @param {Client} client
   * @param {Guild} guild
   */
  async initialize(client, guild) {
    super.initialize(client, guild);

    await ShuffleAddon.#loadConfig(client);

    if (!this.settings[guild.id].length) {
      console.info(`[ShuffleAddon] <${guild.name}> このサーバーでは無効です。`);
      return;
    }

    await this.addCommand(client, guild,
      {
        name: 'shuffle',
        description: 'ボイスチャンネルに参加しているメンバーを対象にシャッフルします。',
      },
      async (client, guild, interaction) => {
        console.info(`[ShuffleAddon] <${guild.name}> コマンド: シャッフル一覧`);

        return {
          content: `シャッフル対象のチャンネル: ${ShuffleAddon.#channels[guild.id]?.join(', ') ?? '(なし)'}`,
          ephemeral: true,
        };
      }
    );

    await this.addCommand(client, guild,
      {
        name: 'shuffle-set',
        description: 'シャッフル対象のボイスチャンネルを設定します。',
        options: [1, 2, 3, 4, 5]
          .map(n => ({
            name: `channel${n}`,
            description: `ボイスチャンネル${n}`,
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          })),
      },
      async (client, guild, interaction) => {
        console.info(`[ShuffleAddon] <${guild.name}> コマンド: シャッフル設定`);

        ShuffleAddon.#channels[guild.id] = [1, 2, 3, 4, 5]
          .map(n => interaction.options.getChannel(`channel${n}`))
          .filter(c => c !== null);

        ShuffleAddon.#saveConfig();

        return {
          content: 'OK',
          ephemeral: true,
        };
      }
    );

    await this.addCommand(client, guild,
      {
        name: 'shuffle',
        description: 'ボイスチャンネルに参加しているメンバーを対象にシャッフルします。',
      },
      async (client, guild, interaction) => {
        console.info(`[ShuffleAddon] <${guild.name}> コマンド: シャッフル`);

        await interaction.reply({ content: 'OK' });
        await this.#shuffle(guild);

        return null;
      }
    );

    console.info(`[ShuffleAddon] <${guild.name}> コマンドを登録しました。`);
  }

  /**
   * 永続化したシャッフル設定をロードします。
   * @param {Client} client
   */
  static async #loadConfig(client) {
    ShuffleAddon.#channels = {};

    let data;
    try {
      data = Array.from(JSON.parse(await fs.readFile(SHUFFLE_FILE)));
    } catch {
      return;
    }

    for (const { guildId, channels } of data) {
      ShuffleAddon.#channels[guildId] = await Promise.all(channels.map(id => client.channels.fetch(id)));
    }
  }

  /**
   * シャッフル設定を永続化します。
   */
  static async #saveConfig() {
    const data = Object.entries(ShuffleAddon.#channels)
      .map(([guildId, channels]) => ({
        guildId,
        channels: channels.map(c => c.id)
      }))

    await fs.writeFile(SHUFFLE_FILE, JSON.stringify(data));
  }

  /**
   * シャッフルを実行します。
   * @param {Guild} guild
   */
  async #shuffle(guild) {
    const channels = ShuffleAddon.#channels[guild.id];
    const members = channels
      .map(c => [...c.members.values()])
      .flat()
      .filter(m => !m.user.bot)
      .sort(() => Math.random() - 0.5);

    const groups = chunkArray(members, Math.ceil(members.length / channels.length));
    groups.forEach((g, i) => console.log(`[ShuffleAddon] <${guild.name}> シャッフル結果(${i + 1}): ${g.map(m => m.user.username).join(', ')}`));

    await Promise.allSettled(
      groups
        .map((g, i) => g.map((m) => m.voice.setChannel(channels[i])))
        .flat()
    );
  }
}

module.exports = ShuffleAddon;
