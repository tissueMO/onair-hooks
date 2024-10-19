const Addon = require('./Addon');
const axios = require('axios').default;

/**
 * ミーティングデバイスの利用状態変更を検知して任意のフック処理を行います。
 */
class HookAddon extends Addon {
  /**
   * @inheritdoc
   */
  get configKey() {
    return 'hooks';
  }

  /**
   * @inheritdoc
   */
  async initialize(client, guild) {
    super.initialize(client, guild);

    // ミーティングデバイスの利用状態変更を監視
    client.on('voiceStateUpdate', async (oldState, newState) => {
      const guildName = newState.guild.name;
      const userId = newState.id;
      const user = (await newState.guild.members.fetch(newState.id)).user;
      const username = user.username;
      const state = this.#getChangedStateText(oldState, newState);

      if (state) {
        console.info(`[HookAddon] <${guildName}:${username}> ミーティングデバイス ${state}`);

        const results = await Promise.allSettled(
          this.settings[guild.id]
            .filter(h => h.userId === userId && h.state === state)
            .map(({ hook: { url, method, headers, data } }) => axios.request({ url, method, headers, data }))
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failureCount = results.filter(r => r.status === 'rejected').length;
        console.info(`[HookAddon] <${guildName}:${username}> ${results.length}件のフック処理が実行されました。(成功=${successCount}, 失敗=${failureCount})`);
      }
    });

    console.info(`[HookAddon] <${guild.name}> フック設定: ${this.settings[guild.id].length}件`);
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
      if (afterUsedDevices) {
        return 'on';
    } else {
        return null;
      }
    }

    // ボイスチャンネルの退室
    if (isExit) {
      if (afterUsedDevices) {
        return 'off';
      } else {
        return null;
      }
    }

    // ミーティングデバイスの状態変更
    if (beforeUsedDevices !== afterUsedDevices) {
      return afterUsedDevices ? 'on' : 'off';
    }

    return null;
  }
}

module.exports = HookAddon;
