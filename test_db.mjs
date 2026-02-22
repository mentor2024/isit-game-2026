import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const {data: user} = await supabase.from('user_profiles').select('id').eq('email', 'mentor24@gmail.com').single();
    if(user) {
        console.log("User found.");
        const {data: votes} = await supabase.from('poll_votes').select('poll_id, is_correct, points_earned').eq('user_id', user.id);
        console.log("Votes:", votes);
    } else {
        console.log("User not found by email, getting the only superadmin");
         const {data: u} = await supabase.from('user_profiles').select('id').eq('role', 'superadmin').limit(1).single();
         if(u) {
            const {data: votes} = await supabase.from('poll_votes').select('poll_id, is_correct, points_earned').eq('user_id', u.id);
            console.log("Votes for superadmin:", votes);
         }
    }
}
run();
