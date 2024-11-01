const Addon = require('./Addon');
const fs = require('fs').promises;
const path = require('path');
const { chunkArray } = require('../common');
const { Guild, CommandInteraction, Client, ChannelType, ApplicationCommandOptionType } = require('discord.js');

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
   * 登録するコマンド一覧
   */
  static get COMMANDS() {
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
        options: [
          {
            name: 'channel1',
            description: 'ボイスチャンネル1',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          },
          {
            name: 'channel2',
            description: 'ボイスチャンネル2',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          },
          {
            name: 'channel3',
            description: 'ボイスチャンネル3',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          },
          {
            name: 'channel4',
            description: 'ボイスチャンネル4',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          },
          {
            name: 'channel5',
            description: 'ボイスチャンネル5',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
          },
        ],
      },
    ];
  }

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

    // スラッシュコマンドを追加
    if (this.settings[guild.id].length > 0) {
      await Promise.all(ShuffleAddon.COMMANDS.map(command => client.application.commands.create(command, guild.id)));
      console.info(`[ShuffleAddon] <${guild.name}> コマンドを登録しました。`);
    } else {
      console.info(`[ShuffleAddon] <${guild.name}> このサーバーでは無効です。`);
    }

    // コマンドハンドリング
    client.on('interactionCreate', async (/** @type {CommandInteraction} */ interaction) => {
      if (interaction.guildId !== guild.id || !interaction.isCommand()) {
        return;
      }

      // コマンド別
      switch (interaction.commandName) {
        case 'shuffle-list':
          console.info(`[ShuffleAddon] <${guild.name}> コマンド: シャッフル一覧`);
          await interaction.reply({
            content: `シャッフル対象のチャンネル: ${ShuffleAddon.#channels[guild.id]?.join(', ') ?? '(なし)'}`,
            ephemeral: true,
          });
          break;

        case 'shuffle-set':
          console.info(`[ShuffleAddon] <${guild.name}> コマンド: シャッフル設定`);
          await interaction.reply({
            content: 'OK',
            ephemeral: true,
          });

          ShuffleAddon.#channels[guild.id] = [
            interaction.options.getChannel('channel1'),
            interaction.options.getChannel('channel2'),
            interaction.options.getChannel('channel3'),
            interaction.options.getChannel('channel4'),
            interaction.options.getChannel('channel5'),
          ].filter(c => c !== null);

          ShuffleAddon.#saveConfig();
          break;

        case 'shuffle':
          console.info(`[ShuffleAddon] <${guild.name}> コマンド: シャッフル`);
          await interaction.reply({ content: 'OK' });
          await this.#shuffle(guild);
          break;
      }
    });
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
