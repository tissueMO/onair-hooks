const { Client, Intents, VoiceState } = require('discord.js');
const axios = require('axios').default;
const client = new Client({ intents: Object.keys(Intents.FLAGS) });
const config = require('./config');

/**
 * ログイン完了後に一度だけ実行されます。
 */
client.on('ready', () => {
  console.info(`Botは ${client.user.tag} でログインしています。`)
});

/**
 * ミーティングデバイスの利用状態変更を検知してフック処理を行います。
 */
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guildId = newState.guild.id;
  const guildName = newState.guild.name;
  const userId = newState.id;
  const username = (await newState.guild.members.fetch(newState.id)).user.username;
  const state = getChangedState(oldState, newState);

  if (state) {
    console.info(`[${guildName}]:[${username}] ミーティングデバイス ${state}`);
    const results = await Promise.allSettled(
      config.hooks
        .filter(h => h.guildId === guildId && h.userId === userId && h.state === state)
        .map(({ hook: { url, method, headers, data } }) => axios.request({ url, method, headers, data }))
    );
    console.info(`${results.length}件のフック処理が実行されました。(成功=${results.filter(r => r.status === 'fulfilled').length}, 失敗=${results.filter(r => r.status === 'rejected').length})`);
  }
});

/**
 * ミーティングデバイスの利用状態が変更された場合に変更後の使用状態文字列を返します。
 * @param {VoiceState} oldState
 * @param {VoiceState} newState
 * @returns {'on' | 'off' | null}
 */
const getChangedState = (oldState, newState) => {
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
};

// プロセス終了時にログアウト
process
  .on('SIGINT', () => {
    client.destroy();
    process.exit(1);
  })
  .on('SIGTERM', () => {
    client.destroy();
    process.exit(0);
  });

// フック処理の待ち受けを開始
client.login(process.env.TOKEN);
