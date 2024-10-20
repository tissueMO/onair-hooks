const ffmpeg = require('fluent-ffmpeg');
const { createClient } = require('redis');
const { RedisClientType } = require('@redis/client');

/**
 * 配列を指定した要素数ごとに区切って分割します。
 * @param {any[]} array
 * @param {number} size
 * @returns {any[]}
 */
exports.chunkArray = (array, size) => {
  const result = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
};

/**
 * PCM形式の音声データをWave形式に変換します。
 * @param {string|ReadableStream} inputStream
 * @param {string|WritableStream} outputStream
 * @returns {Promise}
 */
exports.pcmToWav = async (source, destination) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(source)
      .inputOptions([
        '-f s16le',
        '-ar 48k',
        '-ac 2',
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .output(destination)
      .run();
  });
};

/**
 * 接続済みのRedisクライアントを返します。
 * @returns {Promise<RedisClientType>}
 */
exports.createRedisClient = async () => {
  return await createClient({ url: process.env.REDIS_HOST }).connect();
};
