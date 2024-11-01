const { Client, Guild } = require('discord.js');
const Addon = require('./Addon');

/**
 * ボイスチャンネルの移動に連動して任意のユーザーに追従します。
 */
class FollowAddon extends Addon {
  /**
   * @override
   */
  get configKey() {
    return 'follows';
  }

  /**
   * @override
   * @param {Client} client
   * @param {Guild} guild
   */
  async initialize(client, guild) {
    super.initialize(client, guild);

    // ボイスチャンネルの移動を監視
    client.on('voiceStateUpdate', async (oldState, newState) => {
      if (newState.guild.id !== guild.id) {
        return;
      }

      const userId = newState.id;
      const user = (await newState.guild.members.fetch(userId)).user;
      const username = user.username;

      const followers = await Promise.all(
        this.settings[guild.id]
          .filter(f => f.followeeUserId === userId)
          .map(f => newState.guild.members.fetch(f.followerUserId))
      );

      if (followers.length && newState.channelId) {
        console.info(`[FollowAddon] <${guild.name}:${username}> 追従イベント`);

        const channel = await newState.guild.channels.fetch(newState.channelId);
        const results = await Promise.allSettled(
          followers
            .filter(f => !!f.voice.channelId && newState.channelId !== f.voice.channelId)
            .map(f => f.voice.setChannel(channel))
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failureCount = results.filter(r => r.status === 'rejected').length;
        console.info(`[FollowAddon] <${guild.name}:${username}> ${results.length}件のフォロー処理が実行されました。(成功=${successCount}, 失敗=${failureCount})`);
      }
    });

    console.info(`[FollowAddon] <${guild.name}> フォロー設定: ${this.settings[guild.id].length}件`);
  }
}

module.exports = FollowAddon;
