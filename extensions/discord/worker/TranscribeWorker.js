const { default: axios } = require('axios');
const FormData = require('form-data');
const { Agent } = require('http');
const Worker = require('./Worker');
const { DeleteObjectCommand, GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const s3Client = new S3Client();

const whisperClient = axios.create({
  baseURL: process.env.WHISPER_HOST,
  timeout: 300000,
  httpAgent: new Agent({ keepAlive: true }),
});

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
   * @override
   */
  async process() {
    const ids = await this.dequeueAll();

    // 文字起こし
    for (const id of ids) {
      console.info(`<${this.prefix}> ID: ${id} の変換開始...`);

      // 処理対象のデータを取得
      const baseName = `${id}.mp3`;
      const { Body: srcData } = await s3Client.send(new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${process.env.S3_PREFIX}${baseName}`,
      }));

      // 文字起こし実行
      const requestData = new FormData();
      requestData.append('file', srcData);

      const { data: responseData } = await whisperClient.post('/transcribe', requestData, { headers: requestData.getHeaders() });

      // 後片付け
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${process.env.S3_PREFIX}${baseName}`,
      }));

      // コンテキストに文字起こし結果を反映
      const context = await this.redisClient.get(`context:${id}`)
        .then(context => context ? JSON.parse(context) : null);

      if (!context) {
        console.error(`<${this.prefix}> ID: ${id} の変換失敗: 格納先コンテキストがありません。`);
        continue;
      }

      context['transcription'] = responseData['transcription'] ?? '(文字起こし失敗)';

      await this.redisClient.setEx(`context:${id}`, 43200, JSON.stringify(context));

      console.info(`<${this.prefix}> ID: ${id} の文字起こし完了`);
    }
  }
}

module.exports = TranscribeWorker;
