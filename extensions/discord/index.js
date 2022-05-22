const { Client, Intents } = require('discord.js');
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
  const state = newState.selfMute ? 'off' : 'on';

  if (oldState.selfMute !== newState.selfMute) {
    console.info(`[${guildName}]:[${username}] マイク ${state}`);
    const results = await Promise.allSettled(
      config.hooks
        .filter(h => h.guildId === guildId && h.userId === userId && h.state === state)
        .map(({ hook: { url, method, headers, data } }) => axios.request({ url, method, headers, data }))
    );
    console.info(`${results.length}件のフック処理が実行されました。(成功=${results.filter(r => r.status === 'fulfilled').length}, 失敗=${results.filter(r => r.status === 'rejected').length})`);
  }
});

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
