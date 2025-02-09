import { createClient } from 'redis';
import fs from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { default as axios } from 'axios';
import FormData from 'form-data';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client();

/**
 * PCM→MP3形式に変換します。
 */
export async function convert(event) {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const id = path.parse(key).name;
  const prefix = path.parse(key).dir;

  console.info(`ID: ${id} の変換開始...`);

  // 対象ファイルパス
  const srcPath = path.join(`/tmp/${id}.pcm`);
  const destPath = path.join(`/tmp/${id}.mp3`);

  // (pcm) ダウンロード・削除
  const { Body: srcData } = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(srcData, createWriteStream(srcPath));

  // PCM→MP3 変換
  await pcmToMp3(srcPath, destPath);

  // (mp3) アップロード
  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${prefix}/${id}.mp3`,
    Body: createReadStream(destPath),
    ContentType: 'audio/mpeg',
  }));

  // 後片付け
  await fs.unlink(srcPath);
  await fs.unlink(destPath);
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  console.info(`ID: ${id} の変換完了`);
}

/**
 * 文字起こしを行います。
 */
export async function transcribe(event) {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const id = path.parse(key).name;
  const prefix = path.parse(key).dir;

  console.info(`ID: ${id} の変換開始...`);

  // 対象ファイルパス
  const namespace = path.basename(prefix);
  const srcPath = path.join(`/tmp/${id}.mp3`);

  // (mp3) ダウンロード・削除
  const { Body: srcData } = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(srcData, createWriteStream(srcPath));

  // 文字起こし実行
  let transcription;
  try {
    const requestData = createFormData({
      file: createReadStream(srcPath),
      model: 'whisper-1',
      language: 'ja',
    });

    transcription = await axios.post(`${process.env.OPENAI_API_HOST}/v1/audio/transcriptions`, requestData, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    })
      .then(({ data }) => data.text ?? '(文字起こし失敗)');

  } catch (e) {
    transcription = `(文字起こし失敗: ${e})`;

  } finally {
    // 後片付け
    await fs.unlink(srcPath);
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  // コンテキストを更新
  const redisClient = await createClient({ url: process.env.REDIS_HOST }).connect();
  const context = await redisClient.get(`${namespace}:context:${id}`)
    .then(context => context ? JSON.parse(context) : null);

  if (!context) {
    console.warn(`ID: ${id} の変換失敗: 格納先コンテキストがありません。`);
    return;
  }

  context['transcription'] = transcription;

  await redisClient.set(`${namespace}:context:${id}`, JSON.stringify(context));

  console.info(`ID: ${id} の文字起こし完了`);
}

/**
 * データを元にFormDataを生成します。
 * @param {Object} data
 * @returns {FormData}
 */
function createFormData(data) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }

  return formData;
}

/**
 * PCM形式の音声データをMP3形式に変換します。
 * @param {string} source
 * @param {string} destination
 * @returns {Promise}
 */
async function pcmToMp3(source, destination) {
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
