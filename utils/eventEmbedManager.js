const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase = require('./supabaseClient');
const { DateTime } = require('luxon');

async function buildEventEmbed(eventData, participants, alternates) {
    const unixTimestamp = DateTime.fromISO(eventData.event_datetime, { zone: 'utc' }).toSeconds();

    const embed = new EmbedBuilder()
        .setTitle(`${eventData.event_name} (${eventData.event_type})`)
        .setDescription(eventData.description || 'No description provided.')
        .setColor(0x0099FF)
        .addFields(
            { name: '🗓️ Date & Time', value: `<t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)` },
            { name: 'Difficulty', value: eventData.difficulty || 'Not set', inline: true },
            { name: 'Modifiers', value: eventData.special_modifier || 'None', inline: true },
            { name: 'Status', value: eventData.status || 'Upcoming', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Event ID: ${eventData.event_id}` });

    let participantList = participants.map(p => {
        const symbol = '✅';
        return `${symbol} ${p.bungie_display_name || p.discord_name}`;
    }).join('\n') || 'Empty';
    embed.addFields({ name: `Partaking (${participants.length}/${eventData.max_participants})`, value: participantList });

    let alternateList = alternates.map(a => {
        const symbol = a.is_priority_alternate ? '⭐' : '➕';
        return `${symbol} ${a.bungie_display_name || a.discord_name}`;
    }).join('\n') || 'Empty';
    embed.addFields({ name: 'Alternates', value: alternateList });

    if (eventData.is_raid_race && eventData.raid_race_team_formation === 'choose') {
        const { data: teams, error: teamsError } = await supabase
            .from('raid_race_teams')
            .select(`
            team_id,
            team_name,
            creator_discord_id,
            event_participants (
                discord_id,
                users ( bungie_display_name )
            )
        `)
            .eq('event_id', eventData.event_id);

        if (teamsError) {
            console.error("Error fetching race teams for embed:", teamsError);
        } else if (teams && teams.length > 0) {
            embed.addFields({ name: '--- Player Formed Teams ---', value: '\u200B' });
            for (const team of teams) {
                const teamCreator = team.creator_discord_id ? `<@${team.creator_discord_id}>` : 'Unknown';
                const members = team.event_participants.map(p => {
                    return `- ${p.users?.bungie_display_name || `<@${p.discord_id}>`}`;
                }).join('\n');

                const teamSlots = eventData.raid_race_players_per_team || (eventData.event_type.toLowerCase().includes('raid') ? 6 : 3);
                embed.addFields({
                    name: `🔰 ${team.team_name} (${team.event_participants.length}/${teamSlots})`,
                    value: members || '_No members yet._',
                    inline: true
                });
            }
        } else {
            embed.addFields({ name: '--- Player Formed Teams ---', value: '_No teams created yet._' });
        }
    }

    return embed;
}

async function getFormattedParticipants(eventId) {
    const { data: signups, error } = await supabase
        .from('event_participants')
        .select(`
            discord_id,
            signup_role,
            is_priority_alternate,
            users (bungie_display_name, bungie_display_name_code )
        `)
        .eq('event_id', eventId);

    if (error) {
        console.error('Error fetching participants for embed:', error);
        return { participants: [], alternates: [] };
    }

    const participants = [];
    const alternates = [];

    for (const signup of signups) {
        const displayName = signup.users?.bungie_display_name + "#" + signup.users?.bungie_display_name_code || `User <@${signup.discord_id}>`;

        if (signup.signup_role === 'partaking') {
            participants.push({ ...signup, bungie_display_name: displayName });
        } else {
            alternates.push({ ...signup, bungie_display_name: displayName });
        }
    }
    alternates.sort((a, b) => (b.is_priority_alternate ? 1 : 0) - (a.is_priority_alternate ? 1 : 0));

    return { participants, alternates };
}

async function updateEventEmbed(client, eventId) {
    const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('event_id', eventId)
        .single();

    if (eventError || !eventData) {
        console.error(`Error fetching event ${eventId} for embed update:`, eventError);
        return;
    }

    if (!eventData.event_embed_id || !eventData.event_channel_id) {
        console.warn(`Event ${eventId} is missing event_embed_id or event_channel_id. Cannot update embed.`);
        return;
    }

    const { participants, alternates } = await getFormattedParticipants(eventId);
    const newEmbed = await buildEventEmbed(eventData, participants, alternates);
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId(`join_event_partaking_${eventId}`).setLabel('Join (Partaking)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`join_event_alternate_${eventId}`).setLabel('Join (Alternate)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`withdraw_event_${eventId}`).setLabel('Withdraw').setStyle(ButtonStyle.Danger)
        );

    try {
        const channel = await client.channels.fetch(eventData.event_channel_id);
        if (!channel || !channel.isTextBased()) return;
        const message = await channel.messages.fetch(eventData.event_embed_id);
        await message.edit({ embeds: [newEmbed], components: [actionRow] });
    } catch (err) {
        console.error(`Failed to fetch/edit event embed message ${eventData.event_embed_id} in channel ${eventData.event_channel_id}:`, err);
        if (err.code === 10008 || err.code === 10003) {
            await supabase.from('events').update({ event_embed_id: null, event_channel_id: null }).eq('event_id', eventId);
            console.log(`Nulled embed_id and event_channel_id for event ${eventId} as message/channel was not found.`);
        }
    }
}

module.exports = { updateEventEmbed, buildEventEmbed, getFormattedParticipants };