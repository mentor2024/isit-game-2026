require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
      console.error("Auth Error:", authError);
      return;
  }
  const mentorUser = users.find(u => u.email === 'mentorofaio@gmail.com');
  if (mentorUser) {
      const { data, error } = await supabase.from('user_profiles').select('id, role').eq('id', mentorUser.id).single();
      console.log("Profile Data for mentorofaio@gmail.com:", data);
  } else {
      console.log("User mentorofaio@gmail.com not found in auth.");
  }
}
run();
