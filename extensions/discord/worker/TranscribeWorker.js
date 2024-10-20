const { commandOptions } = require('redis');
const { default: axios } = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuid } = require('uuid');
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

      // 実データ取得
      const dataKey = `${this.prefix}:data:input:${id}`;
      const wavData = await this.redisClient.get(commandOptions({ returnBuffers: true }), dataKey);
      this.redisClient.del(dataKey);

      if (!wavData) {
        console.error(`<${this.prefix}> ID: ${id} の変換失敗: 実体ファイルがありません。`);
        continue;
      }

      // 一時ファイルに書き出し
      const wavFile = path.join('/tmp', `${uuid()}.wav`);
      await fs.writeFile(wavFile, wavData);

      // 文字起こし実行
      const requestData = new FormData();
      requestData.append('file', createReadStream(wavFile));
      const { data: responseData } = await whisperClient.post('/transcribe', requestData, { headers: requestData.getHeaders() });
      const transcription = responseData['transcription'] ?? '(文字起こし失敗)';

      // コンテキストに文字起こし結果を反映
      const context = await this.redisClient.get(`context:${id}`)
        .then(context => context ? JSON.parse(context) : null);

      if (!context) {
        console.error(`<${this.prefix}> ID: ${id} の変換失敗: 格納先コンテキストがありません。`);
        continue;
      }

      context['transcription'] = transcription;

      await this.redisClient.setEx(`context:${id}`, 43200, JSON.stringify(context));

      // 後片付け
      await fs.unlink(wavFile);

      console.info(`<${this.prefix}> ID: ${id} の文字起こし完了`);
    }
  }
}

module.exports = TranscribeWorker;
