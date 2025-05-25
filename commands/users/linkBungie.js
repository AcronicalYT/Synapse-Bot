const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../../utils/supabaseClient.js');
const { searchBungieUser } = require('../../utils/bungieService.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('linkbungie')
        .setDescription('Links your Bungie.net account to Synapse.')
        .addStringOption(option =>
            option.setName('bungie_name')
                .setDescription('Your full Bungie Name (e.g., GuardianName#1234)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('preferred_language')
                .setDescription('Your preferred language (e.g., en, fr, de). Defaults to en.')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();

        const fullBungieName = interaction.options.getString('bungie_name');
        const discordUserId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
            const bungieUserData = await searchBungieUser(fullBungieName);

            if (!bungieUserData) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Link Failed')
                    .setDescription(`Could not find a Bungie account with the name \`${fullBungieName}\`.\nPlease ensure the format is correct (e.g., GuardianName#1234) and try again.`);
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }

            const { data: userData, error: userError } = await supabase
                .from('users')
                .upsert(
                    {
                        discord_id: discordUserId,
                        bungie_membership_id: bungieUserData.membershipId,
                        bungie_membership_type: bungieUserData.membershipType,
                        bungie_display_name: bungieUserData.bungieGlobalDisplayName,
                        bungie_display_name_code: bungieUserData.bungieGlobalDisplayNameCode,
                        preferred_language: interaction.options.getString('preferred_language') || 'en',
                        updated_at: new Date().toISOString(),
                    },
                    {
                        onConflict: 'discord_id',
                    }
                )
                .select();

            if (userError) {
                console.error('Supabase error updating users table:', userError);
                throw new Error('Failed to save Bungie user data.');
            }

            const { data: guildSetting, error: guildSettingError } = await supabase
                .from('guild_settings')
                .select('guild_id')
                .eq('guild_id', guildId)
                .maybeSingle();

            if (guildSettingError) {
                console.error('Error checking guild_settings:', guildSettingError);
                throw new Error('Failed to check server settings.');
            }

            if (!guildSetting) {
                console.log(`No settings found for guild ${guildId}. Creating default entry.`);
                const { error: newGuildError } = await supabase
                    .from('guild_settings')
                    .insert({ guild_id: guildId }); 

                if (newGuildError) {
                    console.error('Supabase error creating default guild_settings:', newGuildError);
                    throw new Error('Failed to initialize server settings. Please try again.');
                }
            }

            const { error: prefError } = await supabase
                .from('user_guild_preferences')
                .upsert(
                    {
                        discord_id: discordUserId,
                        guild_id: guildId,
                        share_bungie_profile_in_guild: true,
                        updated_at: new Date().toISOString(),
                    },
                    {
                        onConflict: 'discord_id, guild_id',
                    }
                );

            if (prefError) {
                console.error('Supabase error updating user_guild_preferences table:', prefError);
            }

            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Bungie Account Linked!')
                .setDescription(`Successfully linked your Discord account to Bungie account: \`${bungieUserData.bungieGlobalDisplayName}\`.`)
                .addFields({ name: 'Bungie Membership ID', value: bungieUserData.membershipId, inline: true })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], ephemeral: true });
        } catch (error) {
            console.error('Error in /linkbungie command:', error);
            const systemErrorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Link Failed')
                .setDescription('An unexpected error occurred while trying to link your Bungie account. Please try again later.');
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [systemErrorEmbed], ephemeral: true });
            } else {
                await interaction.editReply({ embeds: [systemErrorEmbed] });
            }
        }
    },
};