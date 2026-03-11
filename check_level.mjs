import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from('polls').select('id, title, poll_order, type').eq('stage', 6).eq('level', 1).order('poll_order');
console.log("Stage 6 Level 1 Polls:", data);
