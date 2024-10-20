const ffmpeg = require('fluent-ffmpeg');
const { createClient } = require('redis');

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
 * Redisに接続し、任意の処理を行います。
 * @param {Function} callback
 * @returns {Promise<*>} コールバック関数が返した値で解決されます。
 */
exports.useRedis = async (callback) => {
  const client = await createClient({ url: process.env.REDIS_HOST }).connect();

  try {
    return await callback?.(client);
  } finally {
    await client.disconnect();
  }
};
