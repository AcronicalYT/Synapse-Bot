const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } = require('discord.js');
const supabase = require('../../utils/supabaseClient'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure Synapse settings for this server.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View all current Synapse configurations for this server.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set_event_category')
                .setDescription('Set the category where event channels will be created.')
                .addChannelOption(option =>
                    option.setName('category')
                        .setDescription('The category channel for events.')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear_event_category')
                .setDescription('Clear the configured event category.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set_notification_channel')
                .setDescription('Set the channel for general event notifications.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel for notifications.')
                        .addChannelTypes(ChannelType.GuildText) 
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear_notification_channel')
                .setDescription('Clear the configured notification channel.'))
        .addSubcommandGroup(group =>
            group.setName('admin_roles')
                .setDescription('Manage bot administrator roles.')
                .addSubcommand(subcommand => subcommand.setName('add').setDescription('Add a bot admin role.').addRoleOption(o => o.setName('role').setDescription('The role to add.').setRequired(true)))
                .addSubcommand(subcommand => subcommand.setName('remove').setDescription('Remove a bot admin role.').addRoleOption(o => o.setName('role').setDescription('The role to remove.').setRequired(true)))
                .addSubcommand(subcommand => subcommand.setName('clear').setDescription('Clear all bot admin roles.')))
        .addSubcommandGroup(group =>
            group.setName('event_creators') 
                .setDescription('Manage roles that can create general events.')
                .addSubcommand(subcommand => subcommand.setName('add').setDescription('Add an event creator role.').addRoleOption(o => o.setName('role').setDescription('The role to add.').setRequired(true)))
                .addSubcommand(subcommand => subcommand.setName('remove').setDescription('Remove an event creator role.').addRoleOption(o => o.setName('role').setDescription('The role to remove.').setRequired(true)))
                .addSubcommand(subcommand => subcommand.setName('clear').setDescription('Clear event creator roles (allows everyone).')))
        .addSubcommandGroup(group =>
            group.setName('race_creators') 
                .setDescription('Manage roles that can create raid/dungeon races.')
                .addSubcommand(subcommand => subcommand.setName('add').setDescription('Add a race creator role.').addRoleOption(o => o.setName('role').setDescription('The role to add.').setRequired(true)))
                .addSubcommand(subcommand => subcommand.setName('remove').setDescription('Remove a race creator role.').addRoleOption(o => o.setName('role').setDescription('The role to remove.').setRequired(true)))
                .addSubcommand(subcommand => subcommand.setName('clear').setDescription('Clear race creator roles (restricts to admins).'))),

    async execute(interaction) {
        const guildId = interaction.guildId;

        const { data: currentGuildSettings } = await supabase
            .from('guild_settings')
            .select('admin_role_ids')
            .eq('guild_id', guildId)
            .maybeSingle();

        let isBotAdmin = false;
        if (currentGuildSettings && currentGuildSettings.admin_role_ids) {
            isBotAdmin = interaction.member.roles.cache.some(role => currentGuildSettings.admin_role_ids.includes(role.id));
        }

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && !isBotAdmin) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();

        try {
            let { data: settings, error: settingsError } = await supabase
                .from('guild_settings')
                .select('*')
                .eq('guild_id', guildId)
                .maybeSingle();

            if (settingsError) throw settingsError;

            if (!settings) {
                const { data: newSettings, error: insertError } = await supabase
                    .from('guild_settings')
                    .insert({ guild_id: guildId })
                    .select()
                    .single();
                if (insertError) throw insertError;
                settings = newSettings;
                await interaction.followUp({ content: 'Initial settings record created for this server. You may need to try your command again or use `/config view`.', ephemeral: true });
                // return; // Or proceed, depending on the command
            }


            if (subcommandGroup) {
                const role = interaction.options.getRole('role');
                let roleArrayColumnName = '';
                let successMessage = '';
                let clearMeaning = '';

                if (subcommandGroup === 'admin_roles') roleArrayColumnName = 'admin_role_ids';
                else if (subcommandGroup === 'event_creators') roleArrayColumnName = 'general_event_creator_role_ids';
                else if (subcommandGroup === 'race_creators') roleArrayColumnName = 'race_creator_role_ids';

                let currentRoles = settings[roleArrayColumnName] || [];

                if (subcommand === 'add') {
                    if (currentRoles.includes(role.id)) {
                        return interaction.editReply({ content: `Role ${role.name} is already in the list for ${subcommandGroup}.` });
                    }
                    currentRoles.push(role.id);
                    successMessage = `Role ${role.name} added to ${subcommandGroup}.`;
                } else if (subcommand === 'remove') {
                    if (!currentRoles.includes(role.id)) {
                        return interaction.editReply({ content: `Role ${role.name} is not in the list for ${subcommandGroup}.` });
                    }
                    currentRoles = currentRoles.filter(id => id !== role.id);
                    successMessage = `Role ${role.name} removed from ${subcommandGroup}.`;
                } else if (subcommand === 'clear') {
                    currentRoles = []; 
                    if (subcommandGroup === 'event_creators') clearMeaning = ' (Now everyone can create general events)';
                    else if (subcommandGroup === 'race_creators') clearMeaning = ' (Now only server/bot admins can create races)';
                    else if (subcommandGroup === 'admin_roles') clearMeaning = ' (Warning: No bot-specific admin roles set. Only server admins can manage bot.)';
                    successMessage = `${subcommandGroup} list cleared${clearMeaning}.`;
                }

                const { error: updateError } = await supabase
                    .from('guild_settings')
                    .update({ [roleArrayColumnName]: currentRoles, updated_at: new Date().toISOString() })
                    .eq('guild_id', guildId);

                if (updateError) throw updateError;
                return interaction.editReply({ content: successMessage });

            } else { 
                if (subcommand === 'view') {
                    const embed = new EmbedBuilder()
                        .setTitle(`Synapse Configuration for ${interaction.guild.name}`)
                        .setColor(0x0099FF);

                    const categoryId = settings.event_category_id;
                    const notifChannelId = settings.notification_channel_id;

                    embed.addFields(
                        { name: 'Event Category', value: categoryId ? `<#${categoryId}> (\`${categoryId}\`)` : 'Not Set' },
                        { name: 'Notification Channel', value: notifChannelId ? `<#${notifChannelId}> (\`${notifChannelId}\`)` : 'Not Set' }
                    );
                    
                    const roleFields = [
                        { name: 'Bot Admin Roles', ids: settings.admin_role_ids || [] },
                        { name: 'General Event Creator Roles', ids: settings.general_event_creator_role_ids || [], note: (settings.general_event_creator_role_ids && settings.general_event_creator_role_ids.length > 0) ? '' : '(Everyone can create)' },
                        { name: 'Race Creator Roles', ids: settings.race_creator_role_ids || [], note: (settings.race_creator_role_ids && settings.race_creator_role_ids.length > 0) ? '' : '(Only server/bot admins can create)' }
                    ];

                    for (const field of roleFields) {
                        let value = field.ids.map(id => `<@&${id}>`).join(', ') || 'None Set';
                        if(field.note) value += ` ${field.note}`;
                        embed.addFields({ name: field.name, value: value });
                    }
                    return interaction.editReply({ embeds: [embed] });
                }

                if (subcommand === 'set_event_category') {
                    const category = interaction.options.getChannel('category');
                    const { error } = await supabase.from('guild_settings').update({ event_category_id: category.id, updated_at: new Date().toISOString() }).eq('guild_id', guildId);
                    if (error) throw error;
                    return interaction.editReply({ content: `Event category set to ${category.name}.` });
                }
                if (subcommand === 'clear_event_category') {
                    const { error } = await supabase.from('guild_settings').update({ event_category_id: null, updated_at: new Date().toISOString() }).eq('guild_id', guildId);
                    if (error) throw error;
                    return interaction.editReply({ content: 'Event category cleared.' });
                }
                 if (subcommand === 'set_notification_channel') {
                    const channel = interaction.options.getChannel('channel');
                    const { error } = await supabase.from('guild_settings').update({ notification_channel_id: channel.id, updated_at: new Date().toISOString() }).eq('guild_id', guildId);
                    if (error) throw error;
                    return interaction.editReply({ content: `Notification channel set to ${channel.name}.` });
                }
                if (subcommand === 'clear_notification_channel') {
                    const { error } = await supabase.from('guild_settings').update({ notification_channel_id: null, updated_at: new Date().toISOString() }).eq('guild_id', guildId);
                    if (error) throw error;
                    return interaction.editReply({ content: 'Notification channel cleared.' });
                }
            }

        } catch (error) {
            console.error('Error in /config command:', error);
            return interaction.editReply({ content: 'An error occurred while processing your configuration request.', ephemeral: true });
        }
    },
};