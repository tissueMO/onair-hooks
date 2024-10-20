const util = require('util')
const parsed = util.parseArgs({
	options: {
		aaa: {
			type: 'string',
		},
		bbb: {
			type: 'string',
			multiple: true,
		},
		ccc: {
			type: 'string',
			short: 'c',
		},
		ddd: {
			type: 'boolean',
			multiple: true,
		},
		eee: {
			type: 'boolean',
			short: 'e',
		},
		fff: {
			type: 'boolean',
			short: 'f',
		}
	}
})
console.log(parsed)
