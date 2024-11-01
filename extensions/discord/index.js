const { Client, GatewayIntentBits } = require('discord.js');
const HookAddon = require('./addon/HookAddon');
const FollowAddon = require('./addon/FollowAddon');
const ShuffleAddon = require('./addon/ShuffleAddon');
const RecordAddon = require('./addon/RecordAddon');

// Discord クライアント
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

// 初回のみ実行
client.once('ready', async () => {
  [...client.guilds.cache.keys()].forEach(guildId => console.info(`Botは <${client.user.tag}@${client.guilds.cache.get(guildId).name}> でログインしています。`));
});

// アドオン登録
new HookAddon().register(client);
new FollowAddon().register(client);
new ShuffleAddon().register(client);
new RecordAddon().register(client);

// 終了時にログアウト
process
  .on('SIGINT', () => {
    client.destroy();
    process.exit(1);
  })
  .on('SIGTERM', () => {
    client.destroy();
    process.exit(0);
  });

// ログインして待ち受け開始
client.login(process.env.DISCORD_TOKEN);
