const { recordsPerWeek, pendingRecordsID, shiftsReminderID, guildId } = require('../config.json');

module.exports = {
	name: 'shiftsReminder',
	cron: '0 0 * * *',
	async execute() {

		const { dbShifts, dbPendingRecords, client } = require('../index.js');
		const day = new Date().toLocaleString('en-us', { weekday: 'long' });

		const shiftData = await dbShifts.findAll({ where: { day: day } });
		const pendingRecords = await dbPendingRecords.findAll({ where: {} });
		const nbPendingRecords = pendingRecords.length;

		let totalShiftRecords = 0;
		const shifts = {};

		for (const shift of shiftData) {
			const nbRecords = Math.floor(recordsPerWeek / (await dbShifts.count({ where: { moderator: shift.moderator } })));
			shifts[shift.moderator] = {
				'records': nbRecords,
			};
			totalShiftRecords += nbRecords;
		}
		
		let assignedRecords = 0;
		if (totalShiftRecords > nbPendingRecords) {
			for (const moderator of Object.keys(shifts)) {
				if (assignedRecords >= nbPendingRecords) {
					shifts[moderator].records = 0;
					continue;
				}
				let nbRecords = Math.floor((shifts[moderator].records / totalShiftRecords) * nbPendingRecords);
				if (assignedRecords + nbRecords > nbPendingRecords) nbRecords = nbPendingRecords - assignedRecords;

				shifts[moderator].records = nbRecords;
				assignedRecords += nbRecords;
			}
		}

		let shiftStr = '';
		let currentRecord = 0;

		for (const moderator of Object.keys(shifts)) {
			const startRecord = {
				'discordid': pendingRecords[currentRecord].discordid,
				'levelname': pendingRecords[currentRecord].levelname,
				'username': pendingRecords[currentRecord].username,
			};
			currentRecord += shifts[moderator].records - 1;
			const endRecord = {
				'discordid': pendingRecords[currentRecord].discordid,
				'levelname': pendingRecords[currentRecord].levelname,
				'username': pendingRecords[currentRecord].username,
			};
			currentRecord++;
			shiftStr += `\n> \n> <@${moderator}>:\n> From: https://discord.com/channels/${guildId}/${pendingRecordsID}/${startRecord.discordid} (${startRecord.levelname} for ${startRecord.username})\n>       to: https://discord.com/channels/${guildId}/${pendingRecordsID}/${endRecord.discordid} (${endRecord.levelname} for ${endRecord.username})\n> (${shifts[moderator].records} records)`;
		}

		await (await client.channels.fetch(shiftsReminderID)).send(`> # ${new Date().toLocaleString('en-us', { weekday: 'long' })} Shifts\n> \n> Total pending records: ${nbPendingRecords}\n> Total assigned records: ${totalShiftRecords > nbPendingRecords ? assignedRecords : totalShiftRecords}\n\n> ## Assigned Records:${shiftStr}\n> \n> You have 24 hours to complete this shift. React to this message with a :white_check_mark: so we know that your shift has been completed`);

	},
};