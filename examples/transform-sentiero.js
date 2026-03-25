const fs = require('fs');
const path = require('path');

const input = JSON.parse(fs.readFileSync(path.join(__dirname, 'sentiero_italia.json'), 'utf8'));

const output = input.map(row => ({
	id: row.id ?? "",
	type: row.type ?? "",
	time: row.unixtime ?? "",
	latitude: row.latitude ?? "",
	longitude: row.longitude ?? "",
	altitude: row.altitude ?? "",
	battery_status: row.battery_status ?? "",
	message: row.message ?? "",
	custom_message: row.custom_message ?? "",
	feed_name: row.feed_name ?? "",
	feed_id: row.feed_id ?? "",
	model: row.model ?? "",
	device_name: row.device_name ?? "",
	local_timezone: row.local_timezone ?? "",
}));

const outPath = path.join(__dirname, 'sentiero_italia-transformed.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, '\t'));
console.log(`Written ${output.length} rows to ${outPath}`);
