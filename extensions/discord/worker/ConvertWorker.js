const fs = require('fs').promises;
const { createWriteStream, createReadStream } = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const Worker = require('./Worker');
const TranscribeWorker = require('./TranscribeWorker');
const { GetObjectCommand, S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const stream = require('stream');
const util = require('util');
const pipeline = util.promisify(stream.pipeline);

const s3Client = new S3Client();

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
  get nextWorkerPrefix() {
    return new TranscribeWorker().prefix;
  }

  /**
   * @override
   */
  async process() {
    const ids = await this.dequeueAll();

    // PCM→MP3形式に変換
    for (const id of ids) {
      console.info(`<${this.prefix}> ID: ${id} の変換開始...`);

      // 処理対象のデータを取得
      const srcBaseName = `${id}.pcm`;
      const srcFile = path.join(process.env.WORKER_PATH, srcBaseName);
      const { Body: srcData } = await s3Client.send(new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${process.env.S3_PREFIX}${srcBaseName}`,
      }));

      await pipeline(srcData, createWriteStream(srcFile));

      // 変換実行
      const destBaseName = `${id}.mp3`;
      const destFile = path.join(process.env.WORKER_PATH, destBaseName);
      await this.#pcmToMp3(srcFile, destFile);

      // 次のキューへ登録
      await this.redisClient.lPush(`${process.env.REDIS_NAMESPACE}:${this.nextWorkerPrefix}:queue`, id);

      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${process.env.S3_PREFIX}${destBaseName}`,
        Body: createReadStream(destFile),
      }));

      // 後片付け
      await fs.unlink(srcFile);

      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${process.env.S3_PREFIX}${srcBaseName}`,
      }));

      console.info(`<${this.prefix}> ID: ${id} の変換完了`);
    }
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
