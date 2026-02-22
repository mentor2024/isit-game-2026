import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    const { data } = await supabase.from('user_profiles').select('id, email').eq('email', 'mentor24@gmail.com').maybeSingle();
    if (data) {
        console.log("User:", data);
        const { data: votes } = await supabase.from('poll_votes').select('poll_id, is_correct').eq('user_id', data.id);
        console.log("Votes:", votes);
    }
}
run();
