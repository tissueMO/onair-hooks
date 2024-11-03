const Worker = require('./Worker');
const { setTimeout } = require('timers/promises');

/**
 * ワーカーマネージャー
 */
class WorkerManager {
  /**
   * @type {Worker[]}
   */
  #workers = [];

  /**
   * ワーカーを追加します。
   * @param {Worker} worker
   * @returns {WorkerManager}
   */
  register(worker) {
    this.#workers.push(worker);
    return this;
  }

  /**
   * ワーカーを開始します。
   */
  async start() {
    await Promise.all(this.#workers.map(async worker => {
      await worker.initialize();

      while (true) {
        await this.#process(worker);
        await setTimeout(1000);
      }
    }));
  }

  /**
   * ワーカーを一度だけ実行します。
   */
  async once() {
    await Promise.all(this.#workers.map(async worker => {
      await worker.initialize();
      await this.#process(worker);
    }));
  }

  /**
   * ワーカーの処理を一度実行し、失敗した場合は復旧を試みます。
   * @param {Worker} worker
   */
  async #process(worker) {
    const ids = await worker.dequeueAll();
    const failedIds = [];

    // 1件ずつ処理
    if (ids.length > 0) {
      console.info(`<${worker.prefix}> 処理対象=${ids.length}件`);
    }

    for (const id of ids) {
      try {
        await worker.process(id);
      } catch (err) {
        console.error(`[ERROR] <${worker.prefix}>`, err);
        failedIds.push(id);
      }
    }

    // 失敗したIDをキューに戻す
    if (failedIds.length > 0) {
      console.info(`<${worker.prefix}> 失敗数=${failedIds.length}件`);
      await worker.enqueue(failedIds);
    }
  }
}

module.exports = WorkerManager;
