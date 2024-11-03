const { createRedisClient } = require('../common');
const { RedisClientType } = require('@redis/client');

/**
 * ワーカー
 */
class Worker {
  /**
   * @type {RedisClientType}
   */
  #redisClient;

  /**
   * 初期化します。
   */
  async initialize() {
    this.#redisClient = await createRedisClient();
  }

  /**
   * キューキー
   * @returns {string}
   */
  get prefix() {
    return 'worker';
  }

  /**
   * Redis クライアント
   * @returns {RedisClientType}
   */
  get redisClient() {
    return this.#redisClient;
  }

  /**
   * 1回分の処理を実行します。
   * @param {string} id
   */
  async process(id) {
  }

  /**
   * ワーカーキューにデータを登録します。
   * @param {string[]} ids
   * @returns {Promise<void>}
   */
  async enqueue(ids) {
    if (!ids.length) {
      return;
    }

    const multi = this.redisClient.multi();
    for (const id of ids) {
      multi.lPush(`${process.env.REDIS_NAMESPACE}:${this.prefix}:queue`, id);
    }
    await multi.exec();
  }

  /**
   * ワーカーキューからデータを1つ取り出します。
   * @returns {Promise<string>}
   */
  async dequeue() {
    return this.redisClient.rPop(`${process.env.REDIS_NAMESPACE}:${this.prefix}:queue`);
  }

  /**
   * ワーカーキューからすべてのデータを取り出します。
   * @returns {Promise<string[]>}
   */
  async dequeueAll() {
    const ids = [];

    let id;
    while (id = await this.dequeue()) {
      ids.push(id);
    }

    return ids;
  }
}

module.exports = Worker;
