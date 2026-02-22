import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const {data: config} = await supabase.from('level_configurations').select('score_tiers').eq('stage', 0).eq('level', 1).single();
    console.log("Config score_tiers:", JSON.stringify(config?.score_tiers, null, 2));
}
run();
