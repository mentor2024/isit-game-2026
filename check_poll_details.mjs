import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from('polls').select('*').in('id', ['835f46b1-68e9-409b-8789-0ca227110682', '3fd0ffc2-2be1-4d15-b6ab-1d70b9a6be7e']);
console.log("Polls:", data);
if (error) console.error(error);
