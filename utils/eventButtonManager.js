const { updateEventEmbed } = require('./eventEmbedManager.js');

async function handleEventButtonInteraction(interaction, client, supabase) {
    const customId = interaction.customId;
    const discordUserId = interaction.user.id;
    let action;
    let eventId;
    let targetRole = null;

    if (customId.startsWith('join_event_partaking_')) {
        action = 'join';
        targetRole = 'partaking';
        eventId = customId.split('_')[3];
    } else if (customId.startsWith('join_event_alternate_')) {
        action = 'join';
        targetRole = 'alternate';
        eventId = customId.split('_')[3];
    } else if (customId.startsWith('withdraw_event_')) {
        action = 'withdraw';
        eventId = customId.split('_')[2];
    } else {
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('event_id, event_name, max_participants, status, event_channel_id')
            .eq('event_id', eventId)
            .single();

        if (eventError || !event) {
            console.error(`Error fetching event ${eventId} for button interaction:`, eventError);
            return interaction.editReply({ content: 'Could not find the event details. It might have been deleted.', ephemeral: true });
        }

        if (event.status !== 'upcoming') {
            return interaction.editReply({ content: `This event is no longer accepting sign-ups or withdrawals as its status is '${event.status}'.`, ephemeral: true });
        }

        let replyMessage = '';
        let publicPingMessage = '';

        if (action === 'join') {
            const { data: signups, error: signupFetchError } = await supabase
                .from('event_participants')
                .select('*')
                .eq('event_id', eventId);

            const { data: user, error: userError } = await supabase
                .from('users')
                .select('bungie_display_name, bungie_display_name_code')
                .eq('discord_id', discordUserId)
                .maybeSingle();

            if (userError) {
                console.error("Error fetching user data:", userError);
            }

            if (signupFetchError) throw signupFetchError;

            const currentUserSignup = signups.find(s => s.discord_id === discordUserId);
            const currentPartakingCount = signups.filter(s => s.signup_role === 'partaking').length;

            let determinedRole = targetRole;
            let isPriorityAlternate = false;

            if (currentUserSignup) {
                if (currentUserSignup.signup_role === targetRole && ((targetRole === 'alternate' && currentUserSignup.is_priority_alternate === false) || targetRole === 'partaking')) {
                    return interaction.editReply({ content: `You are already signed up as '${targetRole}' for "${event.event_name}".`, ephemeral: true });
                }
            }

            if (targetRole === 'partaking') {
                if (currentPartakingCount < event.max_participants) {
                    determinedRole = 'partaking';
                    isPriorityAlternate = false;
                    replyMessage = `You've successfully signed up as 'Partaking' for "${event.event_name}"!`;
                    publicPingMessage = `**${user?.bungie_display_name + "#" + user?.bungie_display_name_code || `<@${discordUserId}>`}** has joined the fight for "${event.event_name}"!`;
                } else {
                    determinedRole = 'alternate';
                    isPriorityAlternate = true;
                    replyMessage = `"${event.event_name}" is currently full. You've been added as a 'Priority Alternate'.`;
                    publicPingMessage = `**${user?.bungie_display_name + "#" + user?.bungie_display_name_code || `<@${discordUserId}>`}** has joined the fight for "${event.event_name}" as an alternate to be subbed in ASAP.`;
                }
            } else {
                determinedRole = 'alternate';
                isPriorityAlternate = !!(currentUserSignup && currentUserSignup.is_priority_alternate && currentUserSignup.signup_role === 'alternate' && determinedRole === 'alternate');
                replyMessage = `You've successfully signed up as 'Alternate' for "${event.event_name}"!`;
                publicPingMessage = `**${user?.bungie_display_name + "#" + user?.bungie_display_name_code || `<@${discordUserId}>`}** has joined "${event.event_name}" as an alternate.`;
            }

            const { error: upsertError } = await supabase
                .from('event_participants')
                .upsert({
                    event_id: eventId,
                    discord_id: discordUserId,
                    signup_role: determinedRole,
                    is_priority_alternate: isPriorityAlternate,
                    signed_up_at: new Date().toISOString(),
                    team_id: null
                }, {
                    onConflict: 'event_id, discord_id'
                });

            if (upsertError) throw upsertError;
        } else if (action === 'withdraw') {
            const { data: existingSignup, error: fetchExistingError } = await supabase
                .from('event_participants')
                .select('*')
                .eq('event_id', eventId)
                .eq('discord_id', discordUserId)
                .maybeSingle();

            const { data: user, error: userError } = await supabase
                .from('users')
                .select('bungie_display_name, bungie_display_name_code')
                .eq('discord_id', discordUserId)
                .maybeSingle();

            if (userError) {
                console.error("Error fetching user data:", userError);
            }

            if (fetchExistingError) throw fetchExistingError;

            if (!existingSignup) {
                return interaction.editReply({ content: `You are not currently signed up for "${event.event_name}".`, ephemeral: true });
            }

            const { error: deleteError } = await supabase
                .from('event_participants')
                .delete()
                .eq('event_id', eventId)
                .eq('discord_id', discordUserId);

            if (deleteError) throw deleteError;

            replyMessage = `You have successfully withdrawn from "${event.event_name}".`;
            publicPingMessage = `**${user?.bungie_display_name + "#" + user?.bungie_display_name_code || `<@${discordUserId}>`}** has returned to orbit.`;

            if (existingSignup.signup_role === 'partaking') {
                const { data: alternates, error: altError } = await supabase
                    .from('event_participants')
                    .select('*, users(bungie_display_name, bungie_display_name_code)')
                    .eq('event_id', eventId)
                    .eq('signup_role', 'alternate')
                    .order('is_priority_alternate', { ascending: false })
                    .order('signed_up_at', { ascending: true })
                    .limit(1);

                if (altError) console.error("Error fetching alternates for promotion:", altError);

                if (alternates && alternates.length > 0) {
                    const promotedUser = alternates[0];
                    const { error: promoteError } = await supabase
                        .from('event_participants')
                        .update({ signup_role: 'partaking', is_priority_alternate: false, updated_at: new Date().toISOString() })
                        .eq('event_id', eventId)
                        .eq('discord_id', promotedUser.discord_id);

                    if (promoteError) {
                        console.error("Error promoting alternate:", promoteError);
                    } else {
                        publicPingMessage += `\n**${promotedUser.users?.bungie_display_name + "#" + promotedUser.users?.bungie_display_name_code || `<@${promotedUser.discord_id}>`}** has been subbed in!`;
                        try {
                            const discordUserToDM = await client.users.fetch(promotedUser.discord_id);
                            await discordUserToDM.send(`🎉 You've been promoted from Alternate to Partaking for the event: "${event.event_name}"!`);
                        } catch (dmError) {
                            console.warn(`Failed to DM promoted user ${promotedUser.discord_id}: ${dmError}`);
                        }
                    }
                }
            }
        }

        await updateEventEmbed(client, eventId);

        await interaction.editReply({ content: replyMessage, ephemeral: true });

        if (publicPingMessage) {
            const eventChannelId = event.event_channel_id || interaction.channelId;
            try {
                const channel = await client.channels.fetch(eventChannelId);
                if(channel && channel.isTextBased()) {
                    await channel.send(publicPingMessage);
                } else {
                    await interaction.channel.send(publicPingMessage);
                }
            } catch (channelError) {
                console.warn(`Could not fetch event channel ${eventChannelId} to send ping, sending in interaction channel. Error: ${channelError}`);
                await interaction.channel.send(publicPingMessage);
            }
        }
    } catch (error) {
        console.error('Error handling event button interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        } else {
            await interaction.editReply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
}

module.exports = { handleEventButtonInteraction };