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
 * マイクミュートの状態変更を検知してフック処理を行います。
 */
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guildId = newState.guild.id;
  const guildName = newState.guild.name;
  const userId = newState.id;
  const username = (await newState.guild.members.fetch(newState.id)).user.username;
  const state = getChangedState(oldState, newState);

  if (state) {
    console.info(`[${guildName}]:[${username}] マイク ${state}`);
    const results = await Promise.allSettled(
      config.hooks
        .filter(h => h.guildId === guildId && h.userId === userId && h.state === state)
        .map(({ hook: { url, method, headers, data } }) => axios.request({ url, method, headers, data }))
    );
    console.info(`${results.length}件のフック処理が実行されました。(成功=${results.filter(r => r.status === 'fulfilled').length}, 失敗=${results.filter(r => r.status === 'rejected').length})`);
  }
});

/**
 * マイクの使用状態が変更された場合に変更後の使用状態文字列を返します。
 * @param {VoiceState} oldState
 * @param {VoiceState} newState
 * @returns {'on' | 'off' | null}
 */
const getChangedState = (oldState, newState) => {
  const isEntry = oldState.channelId === null && newState.channelId !== null;
  const isExit = oldState.channelId !== null && newState.channelId === null;

  // ボイスチャンネルの入室 (ミュート状態)
  if (isEntry && newState.selfMute) {
    return null;
  }
  // ボイスチャンネルの入室 (非ミュート状態)
  if (isEntry && !newState.selfMute) {
    return 'on';
  }

  // ボイスチャンネルの退室 (ミュート状態)
  if (isExit && newState.selfMute) {
    return null;
  }
  // ボイスチャンネルの退室 (非ミュート状態)
  if (isExit && !newState.selfMute) {
    return 'off';
  }

  // ミュート状態の変更
  if (oldState.selfMute !== newState.selfMute) {
    return newState.selfMute ? 'off' : 'on';
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
