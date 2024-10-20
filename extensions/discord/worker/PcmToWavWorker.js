const { commandOptions } = require('redis');
const { pcmToWav } = require('../common');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuid } = require('uuid');
const Worker = require('./Worker');
const TranscribeWorker = require('./TranscribeWorker');

/**
 * 音声変換ワーカー
 */
class PcmToWavWorker extends Worker {
  /**
   * @override
   */
  get prefix() {
    return 'pcm';
  }

  /**
   * 後続のワーカーキー
   * @returns {string}
   */
  get nextWorkerPrefix() {
    return new TranscribeWorker().prefix;
  }

  /**
   * @override
   */
  async process() {
    const ids = await this.dequeueAll();

    // Wav形式に変換
    for (const id of ids) {
      console.info(`<${this.prefix}> ID: ${id} の変換開始...`);

      // 実データ取得
      const dataKey = `${this.prefix}:data:input:${id}`;
      const data = await this.redisClient.get(commandOptions({ returnBuffers: true }), dataKey);
      await this.redisClient.del(dataKey);

      if (!data) {
        console.error(`<${this.prefix}> ID: ${id} の変換失敗: 実体ファイルがありません。`);
        continue;
      }

      // 生成ファイル定義
      const baseFile = path.join('/tmp', `${uuid()}`);
      const pcmFile = `${baseFile}.pcm`;
      const wavFile = `${baseFile}.wav`;

      // 一時ファイルに書き出し
      await fs.writeFile(pcmFile, data);

      // 変換実行
      await pcmToWav(pcmFile, wavFile);

      // 次のキューへ登録
      const wavData = await fs.readFile(wavFile);
      await this.redisClient.multi()
        .lPush(`${this.nextWorkerPrefix}:queue`, id)
        .setEx(`${this.nextWorkerPrefix}:data:input:${id}`, 3600, wavData)
        .exec();

      // 後片付け
      await fs.unlink(pcmFile);
      await fs.unlink(wavFile);

      console.info(`<${this.prefix}> ID: ${id} の変換完了`);
    }
  }
}

module.exports = PcmToWavWorker;
