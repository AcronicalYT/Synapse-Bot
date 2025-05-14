const supabase = require('../utils/supabaseClient.js'); 

module.exports = {
    name: 'guildCreate',
    trigger: 'guildCreate',
    once: false,
    async execute(guild) {
        console.log(`Synapse joined a new guild: ${guild.name} (ID: ${guild.id})`);

        try {
            const { data: existingSettings, error: fetchError } = await supabase
                .from('guild_settings')
                .select('guild_id')
                .eq('guild_id', guild.id)
                .maybeSingle();

            if (fetchError) {
                console.error(`Error fetching guild_settings for ${guild.id} on join:`, fetchError);
            }

            if (existingSettings) {
                console.log(`Settings already exist for guild ${guild.id}. No action needed.`);
                return;
            }

            const { error: insertError } = await supabase
                .from('guild_settings')
                .insert({
                    guild_id: guild.id,
                });

            if (insertError) {
                console.error(`Failed to insert default guild_settings for ${guild.id}:`, insertError);
            } else {
                console.log(`Successfully initialized default settings for guild ${guild.id}.`);
            }

        } catch (error) {
            console.error(`Overall error in guildCreate handler for ${guild.id}:`, error);
        }
    },
};