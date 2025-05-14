const { readdirSync } = require('fs');
const ascii = require('ascii-table')
let table = new ascii("Events").setHeading('Event', ' Load status');

module.exports = async (client) => {
    const eventFiles = readdirSync('./events').filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(`../events/${file}`);
        if (!event.name) {
            table.addRow(file, '❌ - Unable to find name property');
            continue;
        }
        table.addRow(event.name, '✅');
        if (event.once) {
            client.once(event.trigger, (...args) => event.execute(...args, client));
        } else {
            client.on(event.trigger, (...args) => event.execute(...args, client));
        }
    }
    console.log(table.toString());
}