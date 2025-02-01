const { Client, GatewayIntentBits } = require('discord.js');
const { RecordAddon, HookAddon, FollowAddon, ShuffleAddon, Addon } = require('./addon');

// アドオン定義
/** @type {(typeof Addon)[]} */
const addons = [HookAddon, FollowAddon, ShuffleAddon, RecordAddon];

// Discord クライアント
/** @type {Client[]} */
const clients = [process.env.DISCORD_TOKEN_1, process.env.DISCORD_TOKEN_2]
  .filter(token => !!token)
  .map(token => [
    token,
    new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildScheduledEvents,
      ],
    }),
  ])
  .map(([token, client], index) => {
    // クライアントログイン
    client.login(token);

    // アドオン登録
    addons.forEach(addon => (new addon()).register(client));

    client.once('ready', async () => {
      [...client.guilds.cache.keys()].forEach(guildId => {
        console.info(`Bot#${index}は <${client.user.tag}@${client.guilds.cache.get(guildId).name}> でログインしました。`);
      });
    });

    return client;
  });

// 終了時にログアウト
process
  .on('SIGINT', async () => {
    await Promise.all(clients.map(client => client.destroy()));
    process.exit(1);
  })
  .on('SIGTERM', async () => {
    await Promise.all(clients.map(client => client.destroy()));
    process.exit(0);
  });
