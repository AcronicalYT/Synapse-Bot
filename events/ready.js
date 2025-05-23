const { ActivityType } = require('discord.js');
const { initializeEventScheduler } = require('../utils/eventScheduler.js')

module.exports = {
    name: 'ready',
    trigger: 'ready',
    once: true,
    async execute(client) {
        await initializeEventScheduler(client);
        client.user.setPresence({ activities: [{ name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching }], status: 'online' });
        console.log(`Logged in as ${client.user.tag}`);
    }
}