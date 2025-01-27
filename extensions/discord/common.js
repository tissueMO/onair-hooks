const { createClient } = require('redis');
const { RedisClientType } = require('@redis/client');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

/**
 * 時刻文字列から日時オブジェクトを生成します。
 * @param {string} time
 * @returns {dayjs.Dayjs?}
 */
exports.parseTime = (time) => {
  try {
    const now = dayjs().tz().format('YYYY-MM-DD');
    return dayjs.tz(`${now}T${time}:00Z`);
  } catch (err) {
    return null;
  }
};

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
exports.createRedisClient = () => {
  return createClient({ url: process.env.REDIS_HOST }).connect();
};

/**
 * データを元にFormDataを生成します。
 * @param {Object} data
 * @returns {FormData}
 */
exports.createFormData = (data) => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }

  return formData;
}
