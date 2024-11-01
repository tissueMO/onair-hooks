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
 * 接続済みのRedisクライアントを返します。
 * @returns {Promise<RedisClientType>}
 */
exports.createRedisClient = async () => {
  return await createClient({ url: process.env.REDIS_HOST }).connect();
};
