const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const Worker = require('./Worker');
const TranscribeWorker = require('./TranscribeWorker');

/**
 * 音声変換ワーカー
 */
class ConvertWorker extends Worker {
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
  get #nextWorkerPrefix() {
    return new TranscribeWorker().prefix;
  }

  /**
   * PCM→MP3形式に変換します。
   * @override
   */
  async process(id) {
    console.info(`<${this.prefix}> ID: ${id} の変換開始...`);

    // PCM→MP3 変換
    const srcFile = path.join(process.env.WORKER_PATH, `${id}.pcm`);
    const destFile = path.join(process.env.WORKER_PATH, `${id}.mp3`);
    await this.#pcmToMp3(srcFile, destFile);

    // 次のキューへ登録
    await this.redis.lPush(`${process.env.REDIS_NAMESPACE}:${this.#nextWorkerPrefix}:queue`, id);
    await fs.unlink(srcFile);

    console.info(`<${this.prefix}> ID: ${id} の変換完了`);
  }

  /**
   * PCM形式の音声データをMP3形式に変換します。
   * @param {string} source
   * @param {string} destination
   * @returns {Promise}
   */
  async #pcmToMp3(source, destination) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(source)
        .inputOptions([
          '-f s16le',
          '-ar 48k',
          '-ac 2',
        ])
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(destination)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }
}

module.exports = ConvertWorker;
