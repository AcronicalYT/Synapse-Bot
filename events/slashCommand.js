module.exports = {
    name: 'slashCommand',
    trigger: 'interactionCreate',
    once: false,
    async execute(interaction) {
        if (!interaction.isCommand()) return;
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return interaction.reply({ content: `This command doesn't seem to exist!\nContact <${ownerID}> if this is a bug.`, ephemeral: true });
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
}