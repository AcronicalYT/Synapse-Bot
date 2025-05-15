const { handleEventButtonInteraction } = require('../utils/eventButtonManager.js');
const supabase = require('../utils/supabaseClient');

module.exports = {
    name: 'buttonClick',
    trigger: 'interactionCreate',
    once: false,
    async execute(interaction) {
        if (!interaction.isButton()) return;
        const client = interaction.client;
        await handleEventButtonInteraction(interaction, client, supabase);
    }
}