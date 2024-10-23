const { default: axios } = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const { Agent } = require('http');
const Worker = require('./Worker');
const { createReadStream } = require('fs');

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

      // 文字起こし実行
      const file = path.join(process.env.WORKER_PATH, `${id}.mp3`);
      const requestData = new FormData();
      requestData.append('file', createReadStream(file));

      const { data: responseData } = await whisperClient.post('/transcribe', requestData, { headers: requestData.getHeaders() });

      // 後片付け
      await fs.unlink(file);

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