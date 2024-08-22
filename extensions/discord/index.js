const {
  Client,
  GatewayIntentBits,
  VoiceState,
  VoiceChannel,
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios').default;
const client = new Client({ intents: [GatewayIntentBits.GuildVoiceStates] });
const config = require('./config');

const SHUFFLE_FILE = path.join(process.env.STORE_PATH, 'shuffle.json');

/**
 * @type VoiceChannel[]
 */
let shuffleChannels = [];

/**
 * ログイン完了後に一度だけ実行されます。
 */
client.once('ready', async () => {
  const guildId = client.guilds.cache.firstKey();

  console.info(`Botは ${client.user.tag}@${guildId} でログインしています。`);

  // スラッシュコマンドを追加
  const commands = config.commands.filter(c => c.guildId === guildId);
  await client.application.commands.set(commands, guildId);

  // 永続化した設定をロード
  try {
    shuffleChannels = await Promise.all(
      Array.from(JSON.parse(await fs.readFile(SHUFFLE_FILE)))
        .map(id => client.channels.fetch(id))
    );
  } catch {
    shuffleChannels = [];
  }
});

/**
 * スラッシュコマンドをハンドリングします。
 */
client.on('interactionCreate', async (interaction) => {
  const guildName = interaction.guild.name;

  if (!interaction.isCommand()) {
    return;
  }

  switch (interaction.commandName) {
    case 'shuffle-list':
      console.info(`[${guildName}] コマンド: シャッフル一覧`);
      await interaction.reply(`シャッフル対象のチャンネル: ${shuffleChannels.join(', ')}`);
      break;

    case 'shuffle-set':
      console.info(`[${guildName}] コマンド: シャッフル設定`);

      const channels = [
        interaction.options.getChannel('channel1'),
        interaction.options.getChannel('channel2'),
        interaction.options.getChannel('channel3'),
        interaction.options.getChannel('channel4'),
        interaction.options.getChannel('channel5'),
      ]
      shuffleChannels = channels.filter(c => c !== null);

      // 設定を永続化
      await fs.writeFile(SHUFFLE_FILE, JSON.stringify(shuffleChannels.map(c => c.id)));

      await interaction.reply("OK");
      break;

    case 'shuffle':
      console.info(`[${guildName}] コマンド: シャッフル`);
      await interaction.reply("OK");

      // 遅延的にシャッフルを実行
      const members = shuffleChannels
        .map(c => [...c.members.values()])
        .flat()
        .sort(() => Math.random() - 0.5);

      const groups = chunkArray(members, Math.ceil(members.length / shuffleChannels.length));
      groups.forEach((g, i) => console.log(`シャッフル結果(${i + 1}): ${g.map(m => m.user.username).join(', ')}`));

      await Promise.allSettled(
        groups
          .map((g, i) => g.map((m) => m.voice.setChannel(shuffleChannels[i])))
          .flat()
      );
      break;
  }
});

/**
 * ミーティングデバイスの利用状態変更を検知して任意のフック処理を行います。
 */
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guildId = newState.guild.id;
  const guildName = newState.guild.name;
  const userId = newState.id;
  const user = (await newState.guild.members.fetch(newState.id)).user;
  const username = user.username;
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
 * ボイスチャンネルの移動に連動して任意のユーザーに追従するフック処理を行います。
 */
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guildId = newState.guild.id;
  const guildName = newState.guild.name;
  const userId = newState.id;
  const user = (await newState.guild.members.fetch(newState.id)).user;
  const username = user.username;

  const followers = await Promise.all(
    config.follows
      .filter(f => f.guildId === guildId && f.followeeUserId === userId)
      .map(f => newState.guild.members.fetch(f.followerUserId))
  );

  if (followers.length && newState.channelId) {
    console.info(`[${guildName}]:[${username}] 追従イベント`);

    const channel = await newState.guild.channels.fetch(newState.channelId);
    const results = await Promise.allSettled(
      followers
        .filter(f => !!f.voice.channelId && newState.channelId !== f.voice.channelId)
        .map(f => f.voice.setChannel(channel))
    );

    console.info(`${results.length}件のフォロー処理が実行されました。(成功=${results.filter(r => r.status === 'fulfilled').length}, 失敗=${results.filter(r => r.status === 'rejected').length})`);
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

/**
 * 配列を指定した要素数ごとに区切って分割します。
 * @param {any[]} array
 * @param {number} size
 * @returns {any[]}
 */
const chunkArray = (array, size) => {
  const result = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
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
