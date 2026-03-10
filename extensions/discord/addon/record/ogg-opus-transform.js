const { Transform } = require('stream');
const { randomInt } = require('crypto');

/**
 * 参照仕様
 *
 * RFC 7845 Ogg Encapsulation for the Opus Audio Codec
 * https://www.rfc-editor.org/rfc/rfc7845
 *
 * RFC 3533 The Ogg Encapsulation Format Version 0
 * https://www.rfc-editor.org/rfc/rfc3533
 */

const OGG_PAGE_HEADER_SIZE = 27;
const OGG_CAPTURE_PATTERN = Buffer.from('OggS');
const OGG_VERSION = 0;
const OGG_BEGIN_PAGE = 0x02;
const OGG_END_PAGE = 0x04;
const OPUS_FRAME_SIZE = 960n;

// Ogg Opus の ID Header
const OPUS_HEAD = Buffer.from([
  // ヘッダー種別
  ...Buffer.from('OpusHead'),
  // 仕様版数
  1,
  // チャンネル数
  2,
  // 先頭読み飛ばし量
  0, 0,
  // 入力サンプリング周波数
  0x80, 0xbb, 0x00, 0x00,
  // 出力ゲイン
  0, 0,
  // チャンネル割当種別
  0,
]);

// Ogg Opus の Comment Header
const OPUS_TAGS = Buffer.concat([
  // コメントヘッダー種別
  Buffer.from('OpusTags'),
  // ベンダー文字列長
  createUint32Buffer(Buffer.byteLength('onair-hooks')),
  // ベンダー文字列
  Buffer.from('onair-hooks'),
  // ユーザーコメント数
  createUint32Buffer(0),
]);

const CRC32_TABLE = createCrc32Table();

/**
 * 受信した Opus パケット列を Ogg Opus に包みます。
 */
class OggOpusTransform extends Transform {
  /**
   * コンストラクターです。
   */
  constructor() {
    super();
    this.serial = randomInt(0x100000000);
    this.sequence = 0;
    this.granule = 0n;
    this.push(createPage(this.serial, this.sequence++, 0n, OGG_BEGIN_PAGE, [OPUS_HEAD]));
    this.push(createPage(this.serial, this.sequence++, 0n, 0x00, [OPUS_TAGS]));
  }

  /**
   * Opus パケットを Ogg ページへ変換します。
   * @param {Buffer} chunk
   * @param {BufferEncoding} _
   * @param {(error?: Error | null) => void} callback
   * @returns {void}
   */
  _transform(chunk, _, callback) {
    this.granule += OPUS_FRAME_SIZE;
    this.push(createPage(this.serial, this.sequence++, this.granule, 0x00, [chunk]));
    callback();
  }

  /**
   * 終端ページを出力して完了します。
   * @param {(error?: Error | null) => void} callback
   * @returns {void}
   */
  _flush(callback) {
    this.push(createPage(this.serial, this.sequence++, this.granule, OGG_END_PAGE, []));
    callback();
  }
}

/**
 * Ogg ページを生成します。
 * @param {number} serial
 * @param {number} sequence
 * @param {bigint} granule
 * @param {number} headerType
 * @param {Buffer[]} packets
 * @returns {Buffer}
 */
function createPage(serial, sequence, granule, headerType, packets) {
  const segments = packets.flatMap(packet => splitPacket(packet));
  const body = Buffer.concat(packets);
  const header = Buffer.alloc(OGG_PAGE_HEADER_SIZE + segments.length);

  OGG_CAPTURE_PATTERN.copy(header, 0);
  header.writeUInt8(OGG_VERSION, 4);
  header.writeUInt8(headerType, 5);
  header.writeBigUInt64LE(granule, 6);
  header.writeUInt32LE(serial, 14);
  header.writeUInt32LE(sequence, 18);
  header.writeUInt32LE(0, 22);
  header.writeUInt8(segments.length, 26);

  for (const [index, segment] of segments.entries()) {
    header.writeUInt8(segment, OGG_PAGE_HEADER_SIZE + index);
  }

  const page = Buffer.concat([header, body]);
  page.writeUInt32LE(calculateCrc32(page), 22);
  return page;
}

/**
 * Ogg の分割単位を返します。
 * @param {Buffer} packet
 * @returns {number[]}
 */
function splitPacket(packet) {
  if (packet.length === 0) {
    return [0];
  }

  const segments = [];
  for (let offset = 0; offset < packet.length; offset += 255) {
    segments.push(Math.min(255, packet.length - offset));
  }

  if (packet.length % 255 === 0) {
    segments.push(0);
  }

  return segments;
}

/**
 * 32bit 整数をリトルエンディアンの Buffer に変換します。
 * @param {number} value
 * @returns {Buffer}
 */
function createUint32Buffer(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

/**
 * CRC32 の参照表を生成します。
 * @returns {Uint32Array}
 */
function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index++) {
    let value = index << 24;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 0x80000000) ? ((value << 1) ^ 0x04c11db7) : (value << 1);
    }
    table[index] = value >>> 0;
  }

  return table;
}

/**
 * Ogg ページの CRC32 を計算します。
 * @param {Buffer} buffer
 * @returns {number}
 */
function calculateCrc32(buffer) {
  let crc = 0;

  for (const value of buffer) {
    crc = ((crc << 8) ^ CRC32_TABLE[((crc >>> 24) & 0xff) ^ value]) >>> 0;
  }

  return crc >>> 0;
}

module.exports = OggOpusTransform;
