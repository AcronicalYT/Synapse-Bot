const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase = require('../../utils/supabaseClient');
const { DateTime } = require('luxon');
const { updateEventEmbed, buildEventEmbed, getFormattedParticipants } = require('../../utils/eventEmbedManager');

const teamNames = [
    "The Taken Tacos",
    "Crota's Croissants",
    "Gjallarhorny",
    "The Shaxx Pack",
    "Vex on the Beach",
    "The Cabal Crushers",
    "Hive Minded",
    "The Fallen Few",
    "Raid and Chill",
    "The Light Brigade",
    "Sparrow Speedsters",
    "The Iron Bananas",
    "Void Walkers",
    "The Arc Nemeses",
    "Solar Flares"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Manages all aspects of clan events.')
        .addSubcommand(subcommand => // --- CREATE ---
            subcommand.setName('create')
                .setDescription('Creates a new event.')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of the event.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Raid', value: 'Raid' },
                            { name: 'Dungeon', value: 'Dungeon' },
                            { name: 'Raid Race', value: 'Raid Race' },
                            { name: 'Custom', value: 'Custom' }
                        ))
                .addStringOption(option => option.setName('name').setDescription('Name of the event (e.g., Root of Nightmares, Weekly Crucible)').setRequired(true))
                .addStringOption(option => option.setName('description').setDescription('Detailed description of the event.').setRequired(true))
                .addStringOption(option => option.setName('date').setDescription('Event date in YYYY-MM-DD format (UTC)').setRequired(true))
                .addStringOption(option => option.setName('time').setDescription('Event time in HH:MM format (24-hour, UTC)').setRequired(true))
                .addIntegerOption(option => option.setName('max_participants').setDescription('Maximum number of participants (e.g., 6 for raids, 3 for dungeons).'))
                .addStringOption(option =>
                    option.setName('difficulty')
                        .setDescription('Difficulty of the event (e.g., Normal, Master)')
                        .addChoices(
                            { name: 'Normal', value: 'Normal' },
                            { name: 'Legend', value: 'Legend' },
                            { name: 'Master', value: 'Master' }
                        ))
                .addStringOption(option => option.setName('special_modifier').setDescription('Any special modifiers (e.g., Challenges, Duo, Flawless)'))
                .addBooleanOption(option => option.setName('auto_join').setDescription('Automatically sign yourself up for this event? (Default: True)'))
                .addStringOption(option => // For Raid Races
                    option.setName('race_team_formation')
                        .setDescription('Team formation method for Raid Race (Only if type is Raid Race).')
                        .addChoices(
                            { name: 'Players Choose Teams', value: 'choose' },
                            { name: 'Randomly Assigned Teams', value: 'random' }
                        ))
                .addIntegerOption(option => option.setName('race_players_per_team').setDescription('Number of players per team for Raid Race.'))
        )
        .addSubcommand(subcommand => // --- EDIT ---
            subcommand.setName('edit')
                .setDescription('Edits an existing event.')
                .addStringOption(option => option.setName('event_id').setDescription('The ID of the event to edit (from event embed footer or /event list).').setRequired(true))
                .addStringOption(option => option.setName('name').setDescription('New name for the event.'))
                .addStringOption(option => option.setName('description').setDescription('New description for the event.'))
                .addStringOption(option => option.setName('date').setDescription('New event date in YYYY-MM-DD format (UTC)'))
                .addStringOption(option => option.setName('time').setDescription('New event time in HH:MM format (24-hour, UTC)'))
                .addIntegerOption(option => option.setName('max_participants').setDescription('New maximum number of participants.'))
                .addStringOption(option =>
                    option.setName('difficulty')
                        .setDescription('New difficulty of the event')
                        .addChoices( /* Same choices as create */ ))
                .addStringOption(option => option.setName('special_modifier').setDescription('New special modifiers.'))
                .addStringOption(option =>
                    option.setName('status')
                        .setDescription('New status for the event.')
                        .addChoices(
                            { name: 'Upcoming', value: 'upcoming' },
                            { name: 'Active', value: 'active' },
                            { name: 'Completed', value: 'completed' },
                            { name: 'Cancelled', value: 'cancelled' }
                        ))
        )
        .addSubcommand(subcommand => // --- DELETE ---
            subcommand.setName('delete')
                .setDescription('Deletes an event.')
                .addStringOption(option => option.setName('event_id').setDescription('The ID of the event to delete.').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('Optional reason for deletion (sent in DMs).'))
        )
        .addSubcommand(subcommand => // --- LIST ---
            subcommand.setName('list')
                .setDescription('Lists events for this server.')
                .addStringOption(option =>
                    option.setName('filter')
                        .setDescription('Filter which events to show.')
                        .addChoices(
                            { name: 'Upcoming', value: 'upcoming' },
                            { name: 'Past', value: 'past' },
                            { name: 'My Created Events', value: 'my_created' },
                            { name: 'My Signed-up Events', value: 'my_signedup' },
                            { name: 'All', value: 'all' }
                        ))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Filter by event type.')
                        .addChoices(
                            { name: 'Raid', value: 'Raid' },
                            { name: 'Dungeon', value: 'Dungeon' },
                            { name: 'Raid Race', value: 'Raid Race' },
                            { name: 'Custom', value: 'Custom' }
                        ))
        )
        .addSubcommand(subcommand => // --- INFO ---
            subcommand.setName('info')
                .setDescription('Displays detailed information about a specific event.')
                .addStringOption(option =>
                    option.setName('event_id')
                        .setDescription('The ID of the event to view (from event embed footer or /event list).')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('assign_race_teams')
                .setDescription('Randomly assigns participants to teams for a raid race event.')
                .addStringOption(option =>
                    option.setName('event_id')
                        .setDescription('The ID of the raid race event.')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('create_race_team')
                .setDescription('Creates a new team for a "choose team" raid race event.')
                .addStringOption(option =>
                    option.setName('event_id')
                        .setDescription('The ID of the raid race event.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('team_name')
                        .setDescription('The desired name for your new team.'))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('join_race_team')
                .setDescription('Joins an existing team for a "choose team" raid race.')
                .addStringOption(option =>
                    option.setName('event_id')
                        .setDescription('The ID of the raid race event.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('team_name')
                        .setDescription('The name of the team you want to join.')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('leave_race_team')
                .setDescription('Leaves your current team for a "choose team" raid race.')
                .addStringOption(option =>
                    option.setName('event_id')
                        .setDescription('The ID of the raid race event.')
                        .setRequired(true))
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const client = interaction.client;

        if (subcommand === 'list') {
            const guildId = interaction.guildId;
            const filter = interaction.options.getString('filter') || 'upcoming';
            const typeFilter = interaction.options.getString('type');
            const userId = interaction.user.id;

            await interaction.deferReply({ ephemeral: true });

            try {
                let query = supabase.from('events')
                    .select('event_id, event_name, event_type, event_datetime, status, max_participants, event_participants(count)')
                    .eq('guild_id', guildId);

                switch (filter) {
                    case 'upcoming':
                        query = query.eq('status', 'upcoming').gt('event_datetime', DateTime.utc().toISO()).order('event_datetime', { ascending: true });
                        break;
                    case 'past':
                        query = query.or(`status.eq.completed,status.eq.cancelled,event_datetime.lt.${DateTime.utc().toISO()}`).order('event_datetime', { ascending: false });
                        break;
                    case 'my_created':
                        query = query.eq('creator_discord_id', userId).order('event_datetime', { ascending: false });
                        break;
                    case 'my_signedup':
                        const { data: userSignups, error: signupError } = await supabase
                            .from('event_participants')
                            .select('event_id')
                            .eq('discord_id', userId);

                        if (signupError) throw signupError;
                        if (!userSignups || userSignups.length === 0) {
                            return interaction.editReply({ content: 'You are not signed up for any events.', ephemeral: true });
                        }
                        const eventIdsUserIsIn = userSignups.map(s => s.event_id);
                        query = query.in('event_id', eventIdsUserIsIn).order('event_datetime', { ascending: false });
                        break;
                    case 'all':
                        query = query.order('event_datetime', { ascending: false });
                        break;
                }

                if (typeFilter) {
                    query = query.eq('event_type', typeFilter);
                }

                query = query.limit(10);

                const { data: events, error: eventsError } = await query;

                if (eventsError) throw eventsError;

                const listEmbed = new EmbedBuilder()
                    .setTitle(`Events List: ${filter.replace('_', ' ')}${typeFilter ? ` (${typeFilter})` : ''}`)
                    .setColor(0x00AF80);

                if (!events || events.length === 0) {
                    listEmbed.setDescription('No events found matching your criteria.');
                } else {
                    let description = '';
                    for (const event of events) {
                        const unixTimestamp = DateTime.fromISO(event.event_datetime, { zone: 'utc' }).toSeconds();
                        const participantCount = event.event_participants[0]?.count || 0;
                        description += `**ID: \`${event.event_id}\`**\n`;
                        description += `**${event.event_name}** (${event.event_type})\n`;
                        description += `Time: <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n`;
                        description += `Status: ${event.status} | Signups: ${participantCount}/${event.max_participants}\n\n`;
                    }
                    listEmbed.setDescription(description.substring(0, 4090));
                }
                await interaction.editReply({ embeds: [listEmbed], ephemeral: true });
            } catch (error) {
                console.error('Error in /event list:', error);
                await interaction.editReply({ content: `Failed to retrieve event list: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'info') {
            const eventId = interaction.options.getString('event_id');
            const guildId = interaction.guildId;

            await interaction.deferReply({ ephemeral: true });

            try {
                const { data: eventData, error: eventError } = await supabase
                    .from('events')
                    .select('*')
                    .eq('event_id', eventId)
                    .eq('guild_id', guildId)
                    .maybeSingle();

                if (eventError) throw eventError;
                if (!eventData) {
                    return interaction.editReply({ content: 'Could not find an event with that ID in this server.', ephemeral: true });
                }

                const { participants, alternates } = await getFormattedParticipants(eventId);
                const eventEmbed = await buildEventEmbed(eventData, participants, alternates);

                await interaction.editReply({ embeds: [eventEmbed], ephemeral: true });

            } catch (error) {
                console.error(`Error in /event info for event ${eventId}:`, error);
                await interaction.editReply({ content: `Failed to retrieve event information: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'create') {
            const guildId = interaction.guildId;
            const creatorDiscordId = interaction.user.id;

            const { data: settings, error: settingsError } = await supabase
                .from('guild_settings')
                .select('general_event_creator_role_ids, race_creator_role_ids, admin_role_ids, notification_channel_id, event_category_id')
                .eq('guild_id', guildId)
                .maybeSingle();

            if (settingsError) {
                console.error("Error fetching guild settings for event creation:", settingsError);
                return interaction.reply({ content: 'Could not verify permissions due to a database error.', ephemeral: true });
            }

            if (!settings) {
                return interaction.reply({ content: 'Bot settings for this server are not yet initialized. An admin might need to run a setup command.', ephemeral: true });
            }

            let canCreate = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            if (!canCreate && settings.admin_role_ids) {
                canCreate = interaction.member.roles.cache.some(role => settings.admin_role_ids.includes(role.id));
            }

            const eventType = interaction.options.getString('type');
            if (!canCreate) {
                const creatorRoles = eventType === 'Raid Race' ? settings.race_creator_role_ids : settings.general_event_creator_role_ids;
                if (creatorRoles && creatorRoles.length > 0) {
                    canCreate = interaction.member.roles.cache.some(role => creatorRoles.includes(role.id));
                } else {
                    canCreate = (eventType !== 'Raid Race');
                }
            }

            if (!canCreate) {
                return interaction.reply({ content: 'You do not have permission to create this type of event.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const name = interaction.options.getString('name');
            const description = interaction.options.getString('description');
            const dateInput = interaction.options.getString('date');
            const timeInput = interaction.options.getString('time');
            let maxParticipants = interaction.options.getInteger('max_participants');
            const difficulty = interaction.options.getString('difficulty');
            const specialModifier = interaction.options.getString('special_modifier');
            const autoJoin = interaction.options.getBoolean('auto_join') ?? true;

            const isRaidRace = eventType === 'Raid Race';
            const raceTeamFormation = isRaidRace ? interaction.options.getString('race_team_formation') : null;
            const racePlayersPerTeam = isRaidRace ? interaction.options.getInteger('race_players_per_team') : null;

            if (!maxParticipants) {
                if (eventType === 'Raid' || eventType === 'Raid Race') maxParticipants = 6;
                else if (eventType === 'Dungeon') maxParticipants = 3;
                else maxParticipants = 10;
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput) || !/^\d{2}:\d{2}$/.test(timeInput)) {
                return interaction.editReply({ content: 'Invalid date or time format. Please use YYYY-MM-DD for date and HH:MM for time (UTC).', ephemeral: true });
            }
            const utcDateTime = DateTime.fromISO(`${dateInput}T${timeInput}:00.000Z`, { zone: 'utc' });

            if (!utcDateTime.isValid) {
                return interaction.editReply({ content: `Invalid date or time: ${utcDateTime.invalidReason}. Please ensure it's a real date/time in UTC.`, ephemeral: true });
            }
            if (utcDateTime < DateTime.utc().plus({ minutes: 5 })) {
                return interaction.editReply({ content: 'Event date and time must be in the future (at least 5 minutes from now).', ephemeral: true });
            }
            const utcTimestampForDb = utcDateTime.toISO();

            try {
                const { data: newEvent, error: insertError } = await supabase
                    .from('events')
                    .insert({
                        guild_id: guildId,
                        creator_discord_id: creatorDiscordId,
                        event_type: eventType,
                        event_name: name,
                        description: description,
                        event_datetime: utcTimestampForDb,
                        max_participants: maxParticipants,
                        difficulty: difficulty,
                        special_modifier: specialModifier,
                        status: 'upcoming',
                        is_raid_race: isRaidRace,
                        raid_race_team_formation: raceTeamFormation,
                        raid_race_players_per_team: racePlayersPerTeam,
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;

                const eventId = newEvent.event_id;

                let targetChannel = interaction.channel;
                let eventSpecificChannelId = null;

                if (settings.event_category_id) {
                    try {
                        const eventDateForChannel = DateTime.fromISO(utcTimestampForDb, { zone: 'utc' });
                        const day = eventDateForChannel.toFormat('ccc').toLowerCase();
                        const dayOfMonth = eventDateForChannel.day;
                        function getDayWithOrdinal(d) { if (d > 3 && d < 21) return d + 'th'; switch (d % 10) { case 1: return d + 'st'; case 2: return d + 'nd'; case 3: return d + 'rd'; default: return d + 'th'; } }
                        const dateStr = getDayWithOrdinal(dayOfMonth);
                        const eventNameShort = name.replace(/\s+/g, '-').toLowerCase().substring(0, 10);
                        const difficultyShort = difficulty ? difficulty.toLowerCase().substring(0,4) : '';
                        const specialShort = specialModifier ? specialModifier.replace(/\s+/g, '-').toLowerCase().substring(0,6) : '';

                        let channelName = `${day}-${dateStr}-${eventNameShort}`;
                        if (difficultyShort) channelName += `-${difficultyShort}`;
                        if (specialShort) channelName += `-${specialShort}`;
                        channelName = channelName.replace(/[^a-z0-9-]/g, '').substring(0, 100);

                        const categoryChannel = await interaction.guild.channels.fetch(settings.event_category_id);
                        if (categoryChannel && categoryChannel.type === ChannelType.GuildCategory) {
                            const createdChannel = await interaction.guild.channels.create({
                                name: channelName,
                                type: ChannelType.GuildText,
                                parent: categoryChannel,
                                topic: `Event: ${name} on ${dateInput} ${timeInput} UTC. Event ID: ${eventId}`
                            });
                            targetChannel = createdChannel;
                            eventSpecificChannelId = createdChannel.id;
                            await supabase.from('events').update({ event_channel_id: eventSpecificChannelId }).eq('event_id', eventId);
                        }
                    } catch (channelError) {
                        console.error("Failed to create event-specific channel:", channelError);
                        if (settings.notification_channel_id) {
                            try {
                                targetChannel = await interaction.guild.channels.fetch(settings.notification_channel_id);
                            } catch (e) {
                                console.error("Failed to fetch notification channel:", e);
                                targetChannel = interaction.channel;
                            }
                        }
                    }
                } else if (settings.notification_channel_id) {
                    try {
                        targetChannel = await interaction.guild.channels.fetch(settings.notification_channel_id);
                    } catch (e) {
                        console.error("Failed to fetch notification channel:", e);
                        targetChannel = interaction.channel;
                    }
                }

                if (!targetChannel || !targetChannel.isTextBased()) targetChannel = interaction.channel;

                let participants = [];
                let alternates = [];

                if (autoJoin) {
                    const { data: creatorUser, error: creatorFetchError } = await supabase
                        .from('users')
                        .select('bungie_display_name, bungie_display_name_code')
                        .eq('discord_id', creatorDiscordId)
                        .maybeSingle();

                    const creatorDisplayName = creatorUser?.bungie_display_name + "#" + creatorUser?.bungie_display_name_code || interaction.user.username;

                    participants.push({
                        discord_id: creatorDiscordId,
                        bungie_display_name: creatorDisplayName,
                        is_priority_alternate: false
                    });

                    await supabase.from('event_participants').insert({
                        event_id: eventId,
                        discord_id: creatorDiscordId,
                        signup_role: 'partaking',
                        team_id: null
                    });
                }

                const embed = await buildEventEmbed(newEvent, participants, alternates);
                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId(`join_event_partaking_${eventId}`).setLabel('Join (Partaking)').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`join_event_alternate_${eventId}`).setLabel('Join (Alternate)').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`withdraw_event_${eventId}`).setLabel('Withdraw').setStyle(ButtonStyle.Danger)
                    );

                const eventMessage = await targetChannel.send({ embeds: [embed], components: [actionRow] });

                await supabase.from('events').update({ event_embed_id: eventMessage.id, event_channel_id: targetChannel.id }).eq('event_id', eventId);

                let replyMessage = `Event "${name}" created successfully!`;
                if (targetChannel.id !== interaction.channelId) {
                    replyMessage += ` See <#${targetChannel.id}>.`;
                }
                await interaction.editReply({ content: replyMessage, ephemeral: true });
            } catch (error) {
                console.error('Error creating event:', error);
                await interaction.editReply({ content: `Failed to create event: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'edit') {
            const guildId = interaction.guildId;
            const eventId = interaction.options.getString('event_id');
            const editorUserId = interaction.user.id;

            await interaction.deferReply({ ephemeral: true });

            try {
                const { data: event, error: fetchError } = await supabase
                    .from('events')
                    .select('*, guild_settings ( admin_role_ids )')
                    .eq('event_id', eventId)
                    .eq('guild_id', guildId)
                    .maybeSingle();

                if (fetchError) throw fetchError;
                if (!event) return interaction.editReply({ content: 'Event not found or you do not have permission to edit it in this server.', ephemeral: true });

                let canEdit = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                    event.creator_discord_id === editorUserId;

                if (!canEdit && event.guild_settings && event.guild_settings.admin_role_ids) {
                    canEdit = interaction.member.roles.cache.some(role => event.guild_settings.admin_role_ids.includes(role.id));
                }
                if (!canEdit) {
                    return interaction.editReply({ content: 'You do not have permission to edit this event.', ephemeral: true });
                }

                const updates = { updated_at: new Date().toISOString() };
                const changedFields = [];

                if (interaction.options.getString('name')) { updates.event_name = interaction.options.getString('name'); changedFields.push(`Name: ${updates.event_name}`); }
                if (interaction.options.getString('description')) { updates.description = interaction.options.getString('description'); changedFields.push('Description updated'); }
                if (interaction.options.getInteger('max_participants')) { updates.max_participants = interaction.options.getInteger('max_participants'); changedFields.push(`Max Participants: ${updates.max_participants}`); }
                if (interaction.options.getString('difficulty')) { updates.difficulty = interaction.options.getString('difficulty'); changedFields.push(`Difficulty: ${updates.difficulty}`); }
                if (interaction.options.getString('special_modifier') !== null) { updates.special_modifier = interaction.options.getString('special_modifier') || null; changedFields.push(`Modifiers: ${updates.special_modifier || 'None'}`); } // Handle empty string to null
                if (interaction.options.getString('status')) { updates.status = interaction.options.getString('status'); changedFields.push(`Status: ${updates.status}`); }


                const dateInput = interaction.options.getString('date');
                const timeInput = interaction.options.getString('time');

                if (dateInput || timeInput) {
                    const currentDate = DateTime.fromISO(event.event_datetime, { zone: 'utc' });
                    const newDateStr = dateInput || currentDate.toFormat('yyyy-MM-dd');
                    const newTimeStr = timeInput || currentDate.toFormat('HH:mm');

                    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateStr) || !/^\d{2}:\d{2}$/.test(newTimeStr)) {
                        return interaction.editReply({ content: 'Invalid date or time format for update. Please use YYYY-MM-DD for date and HH:MM for time (UTC).', ephemeral: true });
                    }

                    const newUtcDateTime = DateTime.fromISO(`${newDateStr}T${newTimeStr}:00.000Z`, { zone: 'utc' });

                    if (!newUtcDateTime.isValid) {
                        return interaction.editReply({ content: `Invalid new date or time: ${newUtcDateTime.invalidReason}.`, ephemeral: true });
                    }

                    if (updates.status !== 'completed' && updates.status !== 'cancelled' && newUtcDateTime < DateTime.utc().plus({ minutes: 1 })) {
                        return interaction.editReply({ content: 'New event date and time must be in the future.', ephemeral: true });
                    }
                    updates.event_datetime = newUtcDateTime.toISO();
                    const newUnixTimestamp = newUtcDateTime.toSeconds();
                    changedFields.push(`Time: <t:${newUnixTimestamp}:F>`);
                }

                if (Object.keys(updates).length <= 1) {
                    return interaction.editReply({ content: 'No changes were specified.', ephemeral: true });
                }

                const { error: updateError } = await supabase
                    .from('events')
                    .update(updates)
                    .eq('event_id', eventId);

                if (updateError) throw updateError;

                const { data: participantsData, error: pError } = await supabase
                    .from('event_participants')
                    .select('discord_id')
                    .eq('event_id', eventId);

                if (pError) {
                    console.error("Error fetching participants for DM notification:", pError);
                } else if (participantsData) {
                    const dmMessage = `The event "${event.event_name}" (ID: ${eventId}) you signed up for has been updated.\nChanges:\n- ${changedFields.join('\n- ')}`;
                    for (const p of participantsData) {
                        if (p.discord_id !== editorUserId) {
                            try {
                                const user = await interaction.client.users.fetch(p.discord_id);
                                await user.send(dmMessage);
                            } catch (dmError) {
                                console.warn(`Failed to DM user ${p.discord_id} about event update: ${dmError.message}`);
                            }
                        }
                    }
                }

                await updateEventEmbed(interaction.client, eventId);

                await interaction.editReply({ content: `Event "${event.event_name}" (ID: ${eventId}) updated successfully.`, ephemeral: true });
            } catch (error) {
                console.error(`Error editing event ${eventId}:`, error);
                await interaction.editReply({ content: `Failed to edit event: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'delete') {
            const guildId = interaction.guildId;
            const eventId = interaction.options.getString('event_id');
            const deleterUserId = interaction.user.id;
            const reason = interaction.options.getString('reason');

            await interaction.deferReply({ ephemeral: true });

            try {
                const { data: event, error: fetchError } = await supabase
                    .from('events')
                    .select('*, guild_settings ( admin_role_ids )')
                    .eq('event_id', eventId)
                    .eq('guild_id', guildId)
                    .maybeSingle();

                if (fetchError) throw fetchError;
                if (!event) return interaction.editReply({ content: 'Event not found or you do not have permission to delete it in this server.', ephemeral: true });

                let canDelete = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || event.creator_discord_id === deleterUserId;

                if (!canDelete && event.guild_settings && event.guild_settings.admin_role_ids) {
                    canDelete = interaction.member.roles.cache.some(role => event.guild_settings.admin_role_ids.includes(role.id));
                }
                if (!canDelete) {
                    return interaction.editReply({ content: 'You do not have permission to delete this event.', ephemeral: true });
                }

                const { data: participantsData, error: pError } = await supabase
                    .from('event_participants')
                    .select('discord_id')
                    .eq('event_id', eventId);

                if (event.event_embed_id && event.event_channel_id) {
                    try {
                        const channel = await interaction.client.channels.fetch(event.event_channel_id);
                        if (channel && channel.isTextBased()) {
                            const message = await channel.messages.fetch(event.event_embed_id);
                            await message.delete();
                            console.log(`Deleted event embed ${event.event_embed_id} for event ${eventId}`);
                        }
                    } catch (embedDeleteError) {
                        console.warn(`Could not delete event embed ${event.event_embed_id} for event ${eventId}: ${embedDeleteError.message}`);
                    }
                }

                const { error: deleteError } = await supabase
                    .from('events')
                    .delete()
                    .eq('event_id', eventId);

                if (deleteError) throw deleteError;

                if (pError) {
                    console.error("Error fetching participants for DM notification (event deletion):", pError);
                } else if (participantsData) {
                    let dmMessage = `The event "${event.event_name}" (ID: ${eventId}) you signed up for has been cancelled.`;
                    if(reason) dmMessage += `\nReason: ${reason}`;

                    for (const p of participantsData) {
                        if (p.discord_id !== deleterUserId) {
                            try {
                                const user = await interaction.client.users.fetch(p.discord_id);
                                await user.send(dmMessage);
                            } catch (dmError) {
                                console.warn(`Failed to DM user ${p.discord_id} about event cancellation: ${dmError.message}`);
                            }
                        }
                    }
                }

                await interaction.editReply({ content: `Event "${event.event_name}" (ID: ${eventId}) and its sign-ups have been deleted.`, ephemeral: true });
            } catch (error) {
                console.error(`Error deleting event ${eventId}:`, error);
                await interaction.editReply({ content: `Failed to delete event: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'assign_race_teams') {
            const eventId = interaction.options.getString('event_id');
            const guildId = interaction.guildId;
            const execUserId = interaction.user.id;

            await interaction.deferReply({ ephemeral: false });

            try {
                const { data: event, error: eventFetchError } = await supabase
                    .from('events')
                    .select('*, guild_settings ( admin_role_ids )')
                    .eq('event_id', eventId)
                    .eq('guild_id', guildId)
                    .single();

                if (eventFetchError) throw eventFetchError;
                if (!event) return interaction.editReply({ content: 'Raid Race event not found in this server.', ephemeral: true });

                let canManageRace = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                    event.creator_discord_id === execUserId;
                if (!canManageRace && event.guild_settings && event.guild_settings.admin_role_ids) {
                    canManageRace = interaction.member.roles.cache.some(role => event.guild_settings.admin_role_ids.includes(role.id));
                }

                if (!canManageRace) {
                    return interaction.editReply({ content: 'You do not have permission to assign teams for this event.', ephemeral: true });
                }

                if (!event.is_raid_race || event.raid_race_team_formation !== 'random') {
                    return interaction.editReply({ content: 'This event is not a "random team" raid race.', ephemeral: true });
                }
                if (event.status !== 'upcoming') {
                    return interaction.editReply({ content: `Team assignment can only be done for 'upcoming' events. Current status: ${event.status}.`, ephemeral: true });
                }
                if (!event.raid_race_players_per_team || event.raid_race_players_per_team <= 0) {
                    return interaction.editReply({ content: 'The number of players per team for this race is not set or is invalid. Please edit the event to set it.', ephemeral: true });
                }

                const teamSize = event.race_players_per_team;

                const { data: signups, error: signupFetchError } = await supabase
                    .from('event_participants')
                    .select('discord_id, signup_role, is_priority_alternate, users(bungie_display_name)')
                    .eq('event_id', eventId)
                    .order('is_priority_alternate', { ascending: false })
                    .order('signed_up_at', { ascending: true });

                if (signupFetchError) throw signupFetchError;

                const partakingParticipants = signups.filter(s => s.signup_role === 'partaking');
                let availableAlternates = signups.filter(s => s.signup_role === 'alternate');

                if (partakingParticipants.length < teamSize) {
                    return interaction.editReply({ content: `Not enough participants (${partakingParticipants.length}) to form even one team of ${teamSize}.`, ephemeral: true });
                }

                for (let i = partakingParticipants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [partakingParticipants[i], partakingParticipants[j]] = [partakingParticipants[j], partakingParticipants[i]];
                }

                const formedTeams = [];
                const assignedParticipantIds = new Set();

                let teamCounter = 0;

                for (let i = 0; i < partakingParticipants.length; i += teamSize) {
                    teamCounter++;
                    const teamName = `Team ${teamNames[teamCounter - 1] || teamCounter}`;
                    const currentTeamMembers = [];

                    const potentialTeamSlice = partakingParticipants.slice(i, i + teamSize);
                    currentTeamMembers.push(...potentialTeamSlice);

                    while (currentTeamMembers.length < teamSize && availableAlternates.length > 0) {
                        const alternateToUse = availableAlternates.shift();
                        currentTeamMembers.push(alternateToUse);
                        await supabase.from('event_participants')
                            .update({ signup_role: 'partaking', is_priority_alternate: false, updated_at: new Date().toISOString() })
                            .eq('event_id', eventId)
                            .eq('discord_id', alternateToUse.discord_id);
                    }

                    if (currentTeamMembers.length < teamSize && i + teamSize >= partakingParticipants.length) {
                        if (currentTeamMembers.length > 0) {
                            formedTeams.push({ name: `${teamName} (Undersized)`, members: currentTeamMembers });
                        }
                        break;
                    } else if (currentTeamMembers.length < teamSize) {
                        if (currentTeamMembers.length > 0) {
                            formedTeams.push({ name: teamName, members: currentTeamMembers });
                        }
                        continue;
                    }

                    if (currentTeamMembers.length > 0) {
                        formedTeams.push({ name: teamName, members: currentTeamMembers });
                    }
                }

                const teamCreationPromises = [];
                for (const team of formedTeams) {
                    teamCreationPromises.push(
                        supabase.from('raid_race_teams').insert({
                            event_id: eventId,
                            team_name: team.name
                        }).select().single().then(async ({ data: newTeam, error: teamInsertError }) => {
                            if (teamInsertError) throw teamInsertError;
                            team.db_id = newTeam.team_id;
                            const memberUpdatePromises = team.members.map(member => {
                                assignedParticipantIds.add(member.discord_id);
                                return supabase.from('event_participants')
                                    .update({ team_id: newTeam.team_id, updated_at: new Date().toISOString() })
                                    .eq('event_id', eventId)
                                    .eq('discord_id', member.discord_id);
                            });
                            return Promise.all(memberUpdatePromises);
                        })
                    );
                }
                await Promise.all(teamCreationPromises);

                const unassignedPartaking = partakingParticipants.filter(p => !assignedParticipantIds.has(p.discord_id));

                const announcementEmbed = new EmbedBuilder()
                    .setTitle(`⚔️ Teams Assigned for ${event.event_name}! ⚔️`)
                    .setColor(0xFFD700)
                    .setTimestamp();

                if (formedTeams.length > 0) {
                    for (const team of formedTeams) {
                        const memberList = team.members.map(m => {
                            const displayName = m.users?.bungie_display_name || interaction.guild.members.cache.get(m.discord_id)?.displayName || `<@${m.discord_id}>`;
                            return `- ${displayName}`;
                        }).join('\n');
                        announcementEmbed.addFields({ name: `🔰 ${team.name} (ID: ${team.db_id.substring(0,8)})`, value: memberList || 'No members (error?)', inline: false });
                    }
                } else {
                    announcementEmbed.setDescription('No full teams could be formed with the current participants.');
                }

                if (unassignedPartaking.length > 0) {
                    const unassignedList = unassignedPartaking.map(m => {
                        const displayName = m.users?.bungie_display_name || interaction.guild.members.cache.get(m.discord_id)?.displayName || `<@${m.discord_id}>`;
                        return `- ${displayName}`;
                    }).join('\n');
                    announcementEmbed.addFields({ name: '⚠️ Unassigned Participants', value: `These Guardians are awaiting assignment or to form a partial team:\n${unassignedList}`, inline: false });
                }

                if (availableAlternates.length > 0) {
                    const alternateList = availableAlternates.map(m => {
                        const displayName = m.users?.bungie_display_name || interaction.guild.members.cache.get(m.discord_id)?.displayName || `<@${m.discord_id}>`;
                        return `- ${displayName}`;
                    }).join('\n');
                    announcementEmbed.addFields({ name: '🛡️ Available Alternates', value: alternateList, inline: false });
                }

                let targetChannel = interaction.channel;
                if (event.event_channel_id) {
                    try { targetChannel = await client.channels.fetch(event.event_channel_id); }
                    catch {
                        console.error("Failed to fetch event channel:", error);
                        targetChannel = interaction.channel;
                    }
                }
                if (!targetChannel || !targetChannel.isTextBased()) targetChannel = interaction.channel;

                await targetChannel.send({ embeds: [announcementEmbed] });

                await updateEventEmbed(client, eventId);

                await interaction.editReply({ content: 'Teams have been assigned and announced!', ephemeral: true });
            } catch (error) {
                console.error(`Error in /event assign_race_teams for event ${eventId}:`, error);
                await interaction.editReply({ content: `Failed to assign teams: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'create_race_team') {
            const eventId = interaction.options.getString('event_id');
            const teamName = interaction.options.getString('team_name') ? interaction.options.getString('team_name') : teamNames[Math.floor(Math.random() * teamNames.length - 1)];
            const creatorDiscordId = interaction.user.id;
            const guildId = interaction.guildId;

            await interaction.deferReply({ ephemeral: true });

            try {
                const { data: event, error: eventError } = await supabase
                    .from('events')
                    .select('event_id, is_raid_race, raid_race_team_formation, status, raid_race_players_per_team')
                    .eq('event_id', eventId)
                    .eq('guild_id', guildId)
                    .single();

                if (eventError || !event) {
                    return interaction.editReply({ content: 'Event not found or does not belong to this server.' });
                }

                if (!event.is_raid_race || event.raid_race_team_formation !== 'choose') {
                    return interaction.editReply({ content: 'This event is not a "choose team" raid race.' });
                }

                if (event.status !== 'upcoming') {
                    return interaction.editReply({ content: 'Team creation is only allowed for upcoming events.' });
                }

                const { data: participantRecord, error: participantError } = await supabase
                    .from('event_participants')
                    .select('team_id, signup_role')
                    .eq('event_id', eventId)
                    .eq('discord_id', creatorDiscordId)
                    .single();

                if (participantError || !participantRecord) {
                    return interaction.editReply({ content: 'You must be signed up as "Partaking" in this race event to create a team.' });
                }

                if (participantRecord.signup_role !== 'partaking') {
                    return interaction.editReply({ content: 'Only "Partaking" members can create or join race teams.' });
                }

                if (participantRecord.team_id) {
                    return interaction.editReply({ content: 'You are already on a team for this event. Please leave your current team first.' });
                }

                const { data: existingTeam, error: existingTeamError } = await supabase
                    .from('raid_race_teams')
                    .select('team_id')
                    .eq('event_id', eventId)
                    .eq('team_name', teamName)
                    .maybeSingle();

                if (existingTeamError) throw existingTeamError;
                if (existingTeam) {
                    return interaction.editReply({ content: `A team named "${teamName}" already exists for this event. Please choose a different name. If you left the team name blank, please re-run the command.` });
                }

                const { data: newTeam, error: newTeamError } = await supabase
                    .from('raid_race_teams')
                    .insert({
                        event_id: eventId,
                        team_name: teamName,
                        creator_discord_id: creatorDiscordId
                    })
                    .select()
                    .single();

                if (newTeamError) throw newTeamError;

                const { error: updateParticipantError } = await supabase
                    .from('event_participants')
                    .update({ team_id: newTeam.team_id, updated_at: new Date().toISOString() })
                    .eq('event_id', eventId)
                    .eq('discord_id', creatorDiscordId);

                if (updateParticipantError) throw updateParticipantError;

                await interaction.editReply({ content: `Team "${teamName}" created successfully! You've been added to it.` });

                await updateEventEmbed(interaction.client, eventId);
            } catch (error) {
                console.error('Error in /event create_race_team:', error);
                await interaction.editReply({ content: `Failed to create team: ${error.message}` });
            }
        } else if (subcommand === 'join_race_team') {
            const eventId = interaction.options.getString('event_id');
            const teamNameToJoin = interaction.options.getString('team_name');
            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            await interaction.deferReply({ ephemeral: true });

            try {
                const { data: event, error: eventError } = await supabase
                    .from('events')
                    .select('event_id, is_raid_race, raid_race_team_formation, status, raid_race_players_per_team')
                    .eq('event_id', eventId)
                    .eq('guild_id', guildId)
                    .single();

                if (eventError || !event) return interaction.editReply({ content: 'Event not found.' });
                if (!event.is_raid_race || event.raid_race_team_formation !== 'choose') return interaction.editReply({ content: 'This event is not a "choose team" raid race.' });
                if (event.status !== 'upcoming') return interaction.editReply({ content: 'Team joining is only allowed for upcoming events.' });

                const { data: participantRecord, error: pError } = await supabase
                    .from('event_participants')
                    .select('team_id, signup_role')
                    .eq('event_id', eventId)
                    .eq('discord_id', userId)
                    .single();

                if (pError || !participantRecord) return interaction.editReply({ content: 'You must be signed up as "Partaking" in this race event to join a team.' });
                if (participantRecord.signup_role !== 'partaking') return interaction.editReply({ content: 'Only "Partaking" members can join race teams.' });
                if (participantRecord.team_id) return interaction.editReply({ content: 'You are already on a team. Please leave your current team first.' });

                const { data: targetTeam, error: teamFetchError } = await supabase
                    .from('raid_race_teams')
                    .select('team_id, team_name')
                    .eq('event_id', eventId)
                    .eq('team_name', teamNameToJoin)
                    .single();

                if (teamFetchError || !targetTeam) return interaction.editReply({ content: `Team "${teamNameToJoin}" not found for this event.` });

                const { count: teamMemberCount, error: countError } = await supabase
                    .from('event_participants')
                    .select('*', { count: 'exact', head: true })
                    .eq('event_id', eventId)
                    .eq('team_id', targetTeam.team_id);

                if (countError) throw countError;
                if (teamMemberCount >= event.race_players_per_team) {
                    return interaction.editReply({ content: `Team "<span class="math-inline">\{targetTeam\.team\_name\}" is already full \(</span>{event.race_players_per_team} players).` });
                }

                const { error: updateError } = await supabase
                    .from('event_participants')
                    .update({ team_id: targetTeam.team_id, updated_at: new Date().toISOString() })
                    .eq('event_id', eventId)
                    .eq('discord_id', userId);

                if (updateError) throw updateError;

                await interaction.editReply({ content: `You have successfully joined Team "${targetTeam.team_name}"!` });
                await updateEventEmbed(interaction.client, eventId);
            } catch (error) {
                console.error('Error in /event join_race_team:', error);
                await interaction.editReply({ content: `Failed to join team: ${error.message}` });
            }
        } else if (subcommand === 'leave_race_team') {
            const eventId = interaction.options.getString('event_id');
            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            await interaction.deferReply({ ephemeral: true });

            try {
                const { data: event, error: eventError } = await supabase
                    .from('events')
                    .select('event_id, is_raid_race, raid_race_team_formation, status')
                    .eq('event_id', eventId)
                    .eq('guild_id', guildId)
                    .single();

                if (eventError || !event) return interaction.editReply({ content: 'Event not found.' });
                if (!event.is_raid_race || event.raid_race_team_formation !== 'choose') return interaction.editReply({ content: 'This command only applies to "choose team" raid races.' });
                if (event.status !== 'upcoming') return interaction.editReply({ content: 'Team changes are only allowed for upcoming events.' });

                const { data: participantRecord, error: pError } = await supabase
                    .from('event_participants')
                    .select('team_id')
                    .eq('event_id', eventId)
                    .eq('discord_id', userId)
                    .single();

                if (pError) throw pError;
                if (!participantRecord || !participantRecord.team_id) {
                    return interaction.editReply({ content: 'You are not currently on a team for this event.' });
                }

                const teamTheyLeftId = participantRecord.team_id;

                const { error: updateError } = await supabase
                    .from('event_participants')
                    .update({ team_id: null, updated_at: new Date().toISOString() })
                    .eq('event_id', eventId)
                    .eq('discord_id', userId);

                if (updateError) throw updateError;

                const { data: teamInfo, error: teamInfoError } = await supabase
                    .from('raid_race_teams')
                    .select('creator_discord_id')
                    .eq('team_id', teamTheyLeftId)
                    .single();

                if (teamInfo && !teamInfoError) {
                    const { count: remainingMembers, error: countError } = await supabase
                        .from('event_participants')
                        .select('*', { count: 'exact', head: true })
                        .eq('event_id', eventId)
                        .eq('team_id', teamTheyLeftId);

                    if (!countError && remainingMembers === 0) {
                        await supabase.from('raid_race_teams').delete().eq('team_id', teamTheyLeftId);
                        await interaction.followUp({ content: `You have left your team. Since it's now empty, the team has been disbanded.`, ephemeral: true });
                        await updateEventEmbed(interaction.client, eventId);
                        return;
                    }
                }

                await interaction.editReply({ content: 'You have successfully left your team.' });
                await updateEventEmbed(interaction.client, eventId);
            } catch (error) {
                console.error('Error in /event leave_race_team:', error);
                await interaction.editReply({ content: `Failed to leave team: ${error.message}` });
            }
        }
    },
};