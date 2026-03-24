export const REDACTED = '__REDACTED__';

export const providers = {
	findmespot: {
		label: 'SPOT Feed',
		fields: [
			{
				key: 'name',
				type: 'text',
				label: 'Feed Name',
				required: true,
				description: '',
			},
			{
				key: 'feed_id',
				type: 'text',
				label: 'Feed ID',
				required: true,
				description: '',
			},
			{
				key: 'password',
				type: 'password',
				label: 'Feed Password',
				required: false,
				description: 'Leave empty if the feed is public.',
			},
		],
	},
};
