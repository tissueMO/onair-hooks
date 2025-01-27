const { parseArgs } = require('util');
const { ConvertWorker, TranscribeWorker, WorkerManager } = require('./worker/index');

// コマンドライン引数定義
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

// ワーカー定義
const WORKER_CLASSES = {
	convert: ConvertWorker,
	transcribe: TranscribeWorker,
};

// ワーカー登録
const manager = new WorkerManager();

const workerClass = WORKER_CLASSES[parsedArgs.values.worker];
if (workerClass) {
	console.info(`ワーカー [${parsedArgs.values.worker}] を開始します...`);
	manager.register(new workerClass());
} else {
	console.error('無効なワーカーが指定されました。');
	process.exit(1);
}

// ワーカー開始
if (!parsedArgs.values.once) {
	manager.start();
} else {
	manager.once().then(() => process.exit());
}
