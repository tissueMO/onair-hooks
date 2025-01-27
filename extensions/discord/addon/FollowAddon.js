const Addon = require('./Addon');
const { VoiceState } = require('discord.js');

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
   */
  get events() {
    return !this.isPrimary ? [] : [
      {
        event: 'voiceStateUpdate',
        handler: async (/** @type {VoiceState} */ oldState, /** @type {VoiceState} */ newState) => {
          const guild = newState.guild;
          if (!this.handle(guild)) {
            return;
          }

          const userId = newState.id;
          const username = (await guild.members.fetch(userId)).user.username;

          // 追従するユーザーを列挙
          const followers = await Promise.all(
            this.settings[guild.id]
              .filter(f => f.followeeUserId === userId)
              .map(f => guild.members.fetch(f.followerUserId))
          );

          // 対象ユーザーを移動
          if (followers.length && newState.channelId) {
            console.info(`[${this.constructor.name}] <${guild.name}:${username}> 追従イベント`);

            const channel = await guild.channels.fetch(newState.channelId);
            const requests = followers
              .filter(f => !!f.voice.channelId && newState.channelId !== f.voice.channelId)
              .map(f => f.voice.setChannel(channel));

            const results = await Promise.allSettled(requests);

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failureCount = results.filter(r => r.status === 'rejected').length;
            console.info(`[${this.constructor.name}] <${guild.name}:${username}> ${results.length}件のフォロー処理が実行されました。(成功=${successCount}, 失敗=${failureCount})`);
          }
        },
      },
    ];
  }
}

module.exports = FollowAddon;
