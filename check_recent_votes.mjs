import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from('poll_votes').select('poll_id, selected_object_id, created_at, points_earned').order('created_at', { ascending: false }).limit(10);
console.log("Recent Votes:", data);
if (error) console.error("Error:", error);
