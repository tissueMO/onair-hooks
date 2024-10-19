const { BaseInteraction } = require('discord.js');
const Addon = require('./Addon');
const { joinVoiceChannel } = require('@discordjs/voice');

/**
 *
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
    ];
  }

  /**
   * @inheritdoc
   */
  get configKey() {
    return 'records';
  }

  /**
   * @inheritdoc
   */
  async initialize(client, guild) {
    super.initialize(client, guild);

    // スラッシュコマンドを追加
    if (this.settings[guild.id].length > 0) {
      await Promise.all(RecordAddon.COMMANDS.map(command => client.application.commands.create(command, guild.id)));
      console.info(`[RecordAddon] <${guild.name}> コマンドを登録しました。`);
    } else {
      console.info(`[RecordAddon] <${guild.name}> このサーバーでは無効です。`);
    }

    // コマンドハンドリング
    client.on('interactionCreate', async (/** @type {BaseInteraction} */ interaction) => {
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

          this.#connection = joinVoiceChannel({
            guildId: interaction.guildId,
            channelId: channel.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfMute: false,
            selfDeaf: false,
          });

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
      }
    });
  }
}

module.exports = RecordAddon;
