require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('[Supabase Client] Initializing with URL:', supabaseUrl);

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("FATAL ERROR: Supabase URL or Service Key is missing. Check your .env file.");
    if (!supabaseUrl) console.error("SUPABASE_URL is currently undefined or empty.");
    if (!supabaseServiceKey) console.error("SUPABASE_SERVICE_KEY is currently undefined or empty.");
    process.exit(1); 
}

if (!supabaseUrl.startsWith('http')) {
    console.error(`FATAL ERROR: SUPABASE_URL looks incorrect. It should start with 'https://' but found: ${supabaseUrl}`);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;