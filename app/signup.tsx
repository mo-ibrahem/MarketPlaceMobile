import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, UserCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { auth } from '../src/services/lib/supabase';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSignUp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanEmail || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Please enter a valid email and password.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Email',
        text2: 'Please enter a valid email address.',
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Weak Password',
        text2: 'Password must be at least 6 characters.',
      });
      return;
    }

    setLoading(true);
    const displayName = cleanName || cleanEmail.split('@')[0];
    try {
      const { data, error } = await auth.signUp(cleanEmail, password, displayName);
      
      if (error) {
        console.warn('[SignUp] Error:', error.message);
        Toast.show({
          type: 'error',
          text1: 'Sign Up Failed',
          text2: error.message,
        });
        if (Platform.OS !== 'web') {
          Alert.alert("Sign Up Failed", error.message);
        }
      } else if (data?.user && !data?.session) {
        Toast.show({
          type: 'success',
          text1: 'Account created',
          text2: 'Please check your email to verify your account.',
        });
        router.back();
      } else {
        Toast.show({
          type: 'success',
          text1: 'Account created',
          text2: 'You can now sign in to your new EgyBay account.',
        });
        router.back();
      }
    } catch (err: any) {
      console.error('[SignUp] Exception:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err?.message || 'Could not register account.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          {/* ── Branded Hero ── */}
          <LinearGradient
            colors={['#7C3AED', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 32 }]}
          >
            <View style={styles.logoWrap}>
              <Image
                source={require('../assets/images/egbay_logo_header.png')}
                style={{ width: 175, height: 60, resizeMode: 'contain' }}
              />
            </View>
            <Text style={styles.heroTagline}>Join Egbay today</Text>
            <Text style={styles.heroSub}>Buy and sell anything across Egypt</Text>
          </LinearGradient>

          {/* ── Form card ── */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create your account</Text>
            <Text style={styles.formSub}>It only takes a minute</Text>

            {/* Full Name (optional) */}
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <UserCircle size={18} color="#7C3AED" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Full name (optional)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Email */}
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <Mail size={18} color="#7C3AED" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <Lock size={18} color="#7C3AED" />
              </View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Create password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>

            {/* Register button */}
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7C3AED', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerBtnGradient}
              >
                {loading
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.registerBtnText}>Create Account</Text>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Back to login */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.backBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  // Hero
  hero: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 12,
  },
  heroTagline: { fontSize: 16, fontWeight: '800', color: 'white', marginBottom: 4, textAlign: 'center' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.72)', textAlign: 'center' },

  // Form card
  formCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: -28,
    borderRadius: 28,
    padding: 28,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: 40,
  },
  formTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  formSub: { fontSize: 14, color: '#94A3B8', marginBottom: 24 },

  // Input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    height: 54,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#1E293B' },
  eyeBtn: { padding: 4 },

  // Register
  registerBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  registerBtnGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  // Back
  backBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  backBtnText: { color: '#1E293B', fontSize: 15, fontWeight: '700' },
});