const cron = require('node-cron');
const supabase = require('./supabaseClient.js'); 
const { DateTime } = require('luxon');

async function checkAndSendEventReminders(client) { 
    console.log(`[${DateTime.utc().toISO()}] Running: Check for 10-minute event reminders...`);

    const nowUtc = DateTime.utc();
    const reminderWindowStart = nowUtc.toISO();
    const reminderWindowEnd = nowUtc.plus({ minutes: 10 }).toISO();

    try {
        const { data: eventsToRemind, error: fetchError } = await supabase
            .from('events')
            .select('*')
            .eq('status', 'upcoming')
            .eq('is_10_min_reminder_sent', false)
            .gte('event_datetime', reminderWindowStart) 
            .lte('event_datetime', reminderWindowEnd);    

        if (fetchError) {
            console.error('Error fetching events for reminders:', fetchError);
            return;
        }

        if (!eventsToRemind || eventsToRemind.length === 0) {
            return;
        }

        for (const event of eventsToRemind) {
            const eventStartTime = DateTime.fromISO(event.event_datetime, { zone: 'utc' });
            const minutesUntilEvent = eventStartTime.diff(nowUtc, 'minutes').minutes;

            console.log(`Event "${event.event_name}" (ID: ${event.event_id}) is ${minutesUntilEvent.toFixed(2)} minutes away. Sending 10-min reminders.`);

            const { data: participants, error: participantError } = await supabase
                .from('event_participants')
                .select('discord_id')
                .eq('event_id', event.event_id)
                .eq('signup_role', 'partaking'); 

            if (participantError) {
                console.error(`Error fetching participants for event ${event.event_id}:`, participantError);
                continue; 
            }

            if (participants && participants.length > 0) {
                const eventUnixTimestamp = eventStartTime.toSeconds();
                let messageContent = `You're set to syncronise orbit for **"${event.event_name}"** <t:${eventUnixTimestamp}:R>!`;
                if (event.event_channel_id) {
                    messageContent += `\n\nJoin the discussion: <#${event.event_channel_id}>`;
                }

                for (const participant of participants) {
                    try {
                        const user = await client.users.fetch(participant.discord_id);
                        await user.send(messageContent);
                        console.log(`Sent 10-min reminder DM to ${user.tag} for event ${event.event_id}`);
                    } catch (dmError) {
                        console.warn(`Failed to send 10-min reminder DM to user ${participant.discord_id} for event ${event.event_id}: ${dmError.message}`);
                    }
                }
            }

            const { error: updateError } = await supabase
                .from('events')
                .update({ is_10_min_reminder_sent: true, updated_at: new Date().toISOString() })
                .eq('event_id', event.event_id);

            if (updateError) {
                console.error(`Error updating 'is_10_min_reminder_sent' for event ${event.event_id}:`, updateError);
            }
        }
    } catch (err) {
        console.error('Overall error in checkAndSendEventReminders:', err);
    }
}

async function initializeEventScheduler(client) {
    cron.schedule('* * * * *', () => {
        checkAndSendEventReminders(client);
    });
    console.log('Event reminder scheduler initialized to run every minute.');
}

module.exports = { initializeEventScheduler };