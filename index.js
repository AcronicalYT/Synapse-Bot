require('dotenv').config();
const { Collection, Client, GatewayIntentBits, Partials } = require('discord.js');
const token = process.env.DISCORD_TOKEN;
const client = new Client({
    intents:  Object.keys(GatewayIntentBits).map((a) => { return GatewayIntentBits[a] }),
    partials: [ Partials.Message, Partials.Reaction, Partials.Channel, ],
    allowedMentions: { parse: ['users', 'roles'], repliedUser: true, everyone: true }
});

module.exports = client;

client.commands = new Collection();
client.features = new Collection();

["command", "event"].forEach(handler => {
    require(`./handlers/${handler}`)(client);
});

if (!token) {
    console.error("Error: DISCORD_TOKEN not found. Make sure it's set in your .env file.");
    process.exit(1);
}

client.login(token);