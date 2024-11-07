const { Client, GatewayIntentBits } = require('discord.js');
const HookAddon = require('./addon/HookAddon');
const FollowAddon = require('./addon/FollowAddon');
const ShuffleAddon = require('./addon/ShuffleAddon');
const RecordAddon = require('./addon/RecordAddon');

// Discord クライアント起動
const tokens = [process.env.DISCORD_TOKEN_1, process.env.DISCORD_TOKEN_2].filter(token => !!token);
const clients = [];

for (const token of tokens) {
  const index = tokens.indexOf(token);

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

  // 初回のみ実行
  client.once('ready', async () => {
    [...client.guilds.cache.keys()].forEach(guildId => console.info(`Bot#${index + 1}は <${client.user.tag}@${client.guilds.cache.get(guildId).name}> でログインしています。`));
  });

  // アドオン登録
  if (index === 0) {
    new HookAddon().register(client);
    new FollowAddon().register(client);
    new ShuffleAddon().register(client);
  }
  new RecordAddon().register(client);

  // ログインして待ち受け開始
  client.login(token)

  clients.push(client);
}

// 終了時にログアウト
process
  .on('SIGINT', () => {
    clients.forEach(client => client.destroy());
    process.exit(1);
  })
  .on('SIGTERM', () => {
    clients.forEach(client => client.destroy());
    process.exit(0);
  });
