const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PassThrough, Readable } = require('node:stream');
const { test } = require('node:test');
const vm = require('node:vm');
const path = require('node:path');

for (const namespace of ['onairhooks_business', 'onairhooks_private']) {
  test(namespace + ': S3_PREFIXを録音の保存先として使う', async () => {
    const prefix = 'records/' + namespace;
    const uploads = [];
    const redisWrites = [];
    let speaking;
    const connection = {
      receiver: {
        speaking: { on: (event, handler) => { assert.equal(event, 'start'); speaking = handler; } },
        subscribe: () => Readable.from([Buffer.from('audio')]),
      },
    };
    const guild = {
      id: 'guild', name: 'test', voiceAdapterCreator: {},
      members: { fetch: async () => ({ displayName: 'speaker' }) },
    };
    const channel = { id: 'channel', name: 'voice', members: { filter: () => ({ size: 0 }) } };
    const client = { user: { id: 'bot' }, guilds: { cache: new Map([[guild.id, guild]]) } };
    const redis = {
      zRangeByScore: async () => [],
      multi: () => ({
        setEx(key) { redisWrites.push(key); return this; },
        zAdd(key) { redisWrites.push(key); return this; },
        exec: async () => [],
      }),
    };
    class Addon {
      /** テスト用クライアントと設定を登録します。 */
      async register(value) {
        this.client = value;
        this.settings = { guild: [{ captureMinDuration: 0 }] };
      }
    }
    class S3Client {
      /** 外部への送信内容を記録します。 */
      async send(command) { uploads.push(command.input); }
    }
    class PutObjectCommand {
      /** S3の入力を保持します。 */
      constructor(input) { this.input = input; }
    }
    /** テスト用の固定時刻を返します。 */
    const clock = () => ({
      tz() { return this; },
      subtract() { return this; },
      valueOf() { return 0; },
      format() { return '2026-11-01T00:00:00+09:00'; },
      diff() { return 4; },
    });
    clock.extend = () => {};
    clock.tz = { setDefault() {} };
    const fsMock = {
      createWriteStream: () => new PassThrough(),
      createReadStream: () => Readable.from([Buffer.from('ogg')]),
      promises: { rm: async () => {} },
    };
    const mocks = {
      dayjs: clock,
      'dayjs/plugin/timezone': {},
      'dayjs/plugin/utc': {},
      'discord.js': {},
      '@discordjs/voice': {
        joinVoiceChannel: () => connection,
        entersState: async () => {},
        VoiceConnectionStatus: { Ready: 'ready' },
        EndBehaviorType: { AfterSilence: 'silence' },
      },
      './Addon': Addon,
      './record/ogg-opus-transform': PassThrough,
      fs: fsMock,
      'stream/promises': { pipeline: async () => {} },
      uuid: { v4: () => 'recording' },
      '../common': { createRedisClient: async () => redis },
      '@redis/client': {},
      axios: { default: {} },
      '@aws-sdk/client-s3': { S3Client, PutObjectCommand },
    };
    const module = { exports: {} };
    const context = {
      module,
      process: { env: { S3_BUCKET: 'recordings', S3_PREFIX: prefix, REDIS_NAMESPACE: namespace } },
      require(name) {
        if (Object.hasOwn(mocks, name)) { return mocks[name]; }
        assert.equal(name, 'timers/promises');
        return require('node:timers/promises');
      },
      console: { info() {}, error: assert.fail },
    };
    vm.runInNewContext(readFileSync(path.join(__dirname, '../addon/RecordAddon.js'), 'utf8'), context);
    const addon = new module.exports();
    await addon.register(client);
    await addon.commandHandlers.record(guild, {
      options: { getChannel: () => channel },
      deferReply: async () => {},
      editReply: async (message) => assert.equal(message, 'OK'),
    });
    await speaking('speaker');
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].Bucket, 'recordings');
    assert.equal(uploads[0].Key, prefix + '/recording.ogg');
    assert.equal(uploads[0].ContentType, 'audio/ogg');
    assert.deepEqual(redisWrites, [namespace + ':context:recording', namespace + ':contexts']);
  });
}
