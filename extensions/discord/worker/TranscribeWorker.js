const fs = require('fs').promises;
const { default: axios } = require('axios');
const { createReadStream } = require('fs');
const path = require('path');
const Worker = require('./Worker');
const { createFormData } = require('../common');

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

    // 処理対象
    const srcFile = path.join(process.env.WORKER_PATH, `${id}.mp3`);

    // 文字起こし実行
    const requestData = createFormData({
      file: createReadStream(srcFile),
      model: 'whisper-1',
      language: 'ja',
    });
    const { data: responseData } = await axios.post(`${process.env.OPENAI_API_HOST}/v1/audio/transcriptions`, requestData, {
      headers: {
        ...requestData.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    // 後片付け
    await fs.unlink(srcFile);

    // コンテキストを更新
    const context = await this.redis.get(`${process.env.REDIS_NAMESPACE}:context:${id}`)
      .then(context => context ? JSON.parse(context) : null);

    if (!context) {
      console.warn(`<${this.prefix}> ID: ${id} の変換失敗: 格納先コンテキストがありません。`);
      return;
    }

    context['transcription'] = responseData['text'] ?? '(文字起こし失敗)';

    await this.redis.set(`${process.env.REDIS_NAMESPACE}:context:${id}`, JSON.stringify(context));

    console.info(`<${this.prefix}> ID: ${id} の文字起こし完了`);
  }
}

module.exports = TranscribeWorker;
