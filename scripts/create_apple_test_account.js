const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  const email = 'apple.review@egbay.market';
  // Never hardcode this. The literal that used to sit here was committed and
  // is readable by anyone with repo access, which is why the account is being
  // rotated. Removing it here does NOT purge it from git history.
  const password = process.env.APPLE_TEST_PASSWORD;
  const name = 'Apple Reviewer';

  if (!password) {
    throw new Error('Set APPLE_TEST_PASSWORD in the environment before running this.');
  }

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
