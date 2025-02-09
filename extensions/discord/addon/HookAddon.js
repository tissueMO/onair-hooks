const Addon = require('./Addon');
const { default: axios } = require('axios');
const { VoiceState } = require('discord.js');

/**
 * ミーティングデバイスの利用状態変更を検知して任意のフック処理を行います。
 */
class HookAddon extends Addon {
  /**
   * @override
   */
  get configKey() {
    return 'hooks';
  }

  /**
   * @override
   */
  get events() {
    return !this.isPrimary ? [] : [
      {
        name: 'voiceStateUpdate',
        handler: async (/** @type {VoiceState} */ oldState, /** @type {VoiceState} */ newState) => {
          const guild = newState.guild;
          if (!this.isHandle(guild)) {
            return;
          }

          const guildName = guild.name;
          const userId = newState.id;
          const username = (await guild.members.fetch(newState.id)).user.username;
          const state = this.#getChangedStateText(oldState, newState);

          if (state) {
            console.info(`[${this.constructor.name}] <${guildName}:${username}> ミーティングデバイス ${state}`);

            const requests = this.settings[guild.id]
              .filter(h => h.userId === userId && h.state === state)
              .map(({ hook: { url, method, headers, data } }) => axios.request({ url, method, headers, data }));

            const results = await Promise.allSettled(requests);

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failureCount = results.filter(r => r.status === 'rejected').length;
            console.info(`[${this.constructor.name}] <${guildName}:${username}> ${results.length}件のフック処理が実行されました。(成功=${successCount}, 失敗=${failureCount})`);
          }
        },
      },
    ]
  }

  /**
   * ミーティングデバイスの利用状態が変更された場合に変更後の使用状態文字列を返します。
   * @param {VoiceState} oldState
   * @param {VoiceState} newState
   * @returns {'on' | 'off' | null}
   */
  #getChangedStateText(oldState, newState) {
    const isEntry = oldState.channelId === null && newState.channelId !== null;
    const isExit = oldState.channelId !== null && newState.channelId === null;
    const beforeUsedDevices = !oldState.selfMute || oldState.selfVideo;
    const afterUsedDevices = !newState.selfMute || newState.selfVideo;

    // ボイスチャンネルの入室
    if (isEntry) {
      return afterUsedDevices ? 'on' : null;
    }
    // ボイスチャンネルの退室
    if (isExit) {
      return afterUsedDevices ? 'off' : null;
    }
    // ミーティングデバイスの状態変更
    if (beforeUsedDevices !== afterUsedDevices) {
      return afterUsedDevices ? 'on' : 'off';
    }

    return null;
  }
}

module.exports = HookAddon;
