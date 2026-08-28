const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fpqbocohjzwlfcmfropr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcWJvY29oanp3bGZjbWZyb3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTkzNDMsImV4cCI6MjA2NDUzNTM0M30.P6atGZ_u0rkbr76qoIBJN5bRGhe2nESQctXoc25d3xU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const email = 'apple.review@egbay.market';
  const password = 'AppleReview2026!';
  const name = 'Apple Reviewer';

  console.log('1. Attempting sign up...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (signUpError) {
    console.log('SignUp note:', signUpError.message);
  } else {
    console.log('User registered ID:', signUpData?.user?.id);
  }

  console.log('2. Testing sign in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.error('❌ Sign in failed:', signInError.message);
  } else {
    console.log('✅ SIGN IN SUCCESSFUL!');
    console.log('User Email:', signInData.user?.email);
    console.log('User ID:', signInData.user?.id);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
