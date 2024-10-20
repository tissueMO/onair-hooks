const { parseArgs } = require('util');
const WorkerManager = require('./worker/WorkerManager');
const PcmToWavWorker = require('./worker/PcmToWavWorker');
const TranscribeWorker = require('./worker/TranscribeWorker');

// コマンドライン引数
const parsedArgs = parseArgs({
	options: {
		worker: {
			type: 'string',
			multiple: false,
		},
	}
})

// ワーカー登録
const manager = new WorkerManager();

if (parsedArgs.values.worker === 'pcm') {
	console.info('音声変換ワーカーを実行します...');
	manager.register(new PcmToWavWorker());
}
if (parsedArgs.values.worker === 'transcribe') {
	console.info('文字起こしワーカーを実行します...');
	manager.register(new TranscribeWorker());
}

// ワーカー開始
manager.start();
