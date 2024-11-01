const { parseArgs } = require('util');
const WorkerManager = require('./worker/WorkerManager');
const ConvertWorker = require('./worker/ConvertWorker');
const TranscribeWorker = require('./worker/TranscribeWorker');

// コマンドライン引数
const parsedArgs = parseArgs({
	options: {
		worker: {
			type: 'string',
			multiple: false,
		},
		once: {
			type: 'boolean',
			multiple: false,
		},
	}
})

// ワーカー登録
const manager = new WorkerManager();

if (parsedArgs.values.worker === 'convert') {
	console.info('音声変換ワーカーを開始します...');
	manager.register(new ConvertWorker());
}
if (parsedArgs.values.worker === 'transcribe') {
	console.info('文字起こしワーカーを開始します...');
	manager.register(new TranscribeWorker());
}

// ワーカー開始
if (parsedArgs.values.once) {
	manager.once().finally(() => process.exit());
} else {
	manager.start();
}
