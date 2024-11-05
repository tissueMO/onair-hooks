const fs = require('fs').promises;
const { default: axios } = require('axios');
const { createWriteStream, createReadStream } = require('fs');
const path = require('path');
const FormData = require('form-data');
const Worker = require('./Worker');
const { DeleteObjectCommand, GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const stream = require('stream');
const util = require('util');
const pipeline = util.promisify(stream.pipeline);

const s3Client = new S3Client();

/**
 * 文字起こしワーカー
 */
class TranscribeWorker extends Worker {
  /**
   * @override
   */
  get prefix() {
    return 'transcribe';
  }

  /**
   * 文字起こしを行います。
   * @override
   */
  async process(id) {
    console.info(`<${this.prefix}> ID: ${id} の変換開始...`);

    // 処理対象のデータを取得
    const baseName = `${id}.mp3`;
    const srcFile = path.join(process.env.WORKER_PATH, baseName);
    const { Body: srcData } = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: `${process.env.S3_PREFIX}${baseName}`,
    }));

    await pipeline(srcData, createWriteStream(srcFile));

    // 文字起こし実行
    const requestData = new FormData();
    requestData.append('file', createReadStream(srcFile));
    requestData.append('model', 'whisper-1');
    requestData.append('language', 'ja');

    const { data: responseData } = await axios.post(`${process.env.OPENAI_API_HOST}/v1/audio/transcriptions`, requestData, {
      headers: {
        ...requestData.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    // 後片付け
    await fs.unlink(srcFile);
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: `${process.env.S3_PREFIX}${baseName}`,
    }));

    // コンテキストに文字起こし結果を反映
    const context = await this.redisClient.get(`${process.env.REDIS_NAMESPACE}:context:${id}`)
      .then(context => context ? JSON.parse(context) : null);

    if (!context) {
      console.warn(`<${this.prefix}> ID: ${id} の変換失敗: 格納先コンテキストがありません。`);
      return;
    }

    context['transcription'] = responseData['text'] ?? '(文字起こし失敗)';

    await this.redisClient.setEx(`${process.env.REDIS_NAMESPACE}:context:${id}`, 43200, JSON.stringify(context));

    console.info(`<${this.prefix}> ID: ${id} の文字起こし完了`);
  }
}

module.exports = TranscribeWorker;
