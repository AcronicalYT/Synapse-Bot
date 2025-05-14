const { readdirSync } = require('fs');
const path = require('path');
const ascii = require('ascii-table')
let table = new ascii("Commands").setHeading('Command', ' Load status');

module.exports = async (client) => {
    const foldersPath = path.join(__dirname, '../commands');
    const folders = readdirSync(foldersPath);

    for (const folder of folders) {
        const commandsPath = path.join(foldersPath, folder);
        const commands = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commands) {
            const command = require(path.join(commandsPath, file));

            if (command.data && command.execute) {
                await client.commands.set(command.data.name, command);
                table.addRow(command.data.name, '✅');
            } else {
                table.addRow(command.data.name, '❌ - Unable to find data or execute property');
            }
        }
    }

    console.log(table.toString());
}