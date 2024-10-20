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
        try {
          await worker.process();
        } catch (err) {
          console.error(`[ERROR] <${worker.prefix}>`, err);
        }

        await setTimeout(1000);
      }
    }));
  }
}

module.exports = WorkerManager;
