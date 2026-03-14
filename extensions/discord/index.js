const { Client, GatewayIntentBits } = require('discord.js');
const { RecordAddon, HookAddon, ShuffleAddon, Addon } = require('./addon');

let isShuttingDown = false;

// アドオン定義
/** @type {(typeof Addon)[]} */
const addons = [HookAddon, ShuffleAddon, RecordAddon];

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

    client.once('ready', async () => {
      const guildIds = [...client.guilds.cache.keys()];
      for (const guildId of guildIds) {
        console.info(`Bot#${index}は <${client.user.tag}@${client.guilds.cache.get(guildId).name}> でログインしました。`);
      }

      // コマンド初期化
      for (const guildId of guildIds) {
        const oldCommands = await client.application.commands.fetch({ guildId: guildId });
        await Promise.all([...oldCommands.values()].map(command => command.delete()));
      }

      // アドオン登録
      await Promise.all(addons.map(addon => (new addon()).register(client)));

      console.info(`Bot#${index}の起動が完了しました。`);
    });

    return client;
  });

/**
 * Discordクライアントを終了します。
 * @param {number} code
 * @param {*?} reason
 * @returns {Promise<void>}
 */
async function shutdown(code, reason = null) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.info('Discordクライアント終了処理: 開始');

  if (reason) {
    console.error(reason);
  }

  // Botとクライアントの破棄
  RecordAddon.shutdown();

  await Promise.allSettled(clients.map(client => client.destroy()))
    .then(results => results
      .filter(result => result.status === 'rejected')
      .forEach(result => console.error(result.reason))
    );

  console.info('Discordクライアント終了処理: 完了');
  process.exit(code);
}

// 終了時にログアウト
process
  .on('SIGINT', async () => {
    await shutdown(1);
  })
  .on('SIGTERM', async () => {
    await shutdown(0);
  })
  .on('uncaughtException', async (error) => {
    await shutdown(1, error);
  })
  .on('unhandledRejection', async (reason) => {
    await shutdown(1, reason);
  });
