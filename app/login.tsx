import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSignIn = async () => {
    console.log('[Login] Attempting sign-in with:', email);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please enter both your email address and password.',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await auth.signIn(cleanEmail, password);
      if (error) {
        console.warn('[Login] Error:', error.message);
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: error.message,
        });
        if (Platform.OS !== 'web') {
          Alert.alert('Login Failed', error.message);
        }
      } else {
        console.log('[Login] Success! Navigating to home...');
        Toast.show({
          type: 'success',
          text1: 'Welcome to EgyBay!',
        });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('[Login] Exception:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err?.message || 'Could not sign in. Please check your connection.',
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
            colors={['#1D4ED8', '#7C3AED']}
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
            <Text style={styles.heroTagline}>Egypt's #1 Marketplace 🇪🇬</Text>
            <Text style={styles.heroSub}>Buy & sell anything, anywhere in Egypt</Text>
          </LinearGradient>

          {/* ── Form card ── */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSub}>Sign in to your account</Text>

            {/* Email */}
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <Mail size={18} color="#6366F1" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <Lock size={18} color="#6366F1" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#94A3B8" />
                ) : (
                  <Eye size={18} color="#94A3B8" />
                )}
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={() => router.push('/forgot-password' as any)}
              style={{ alignSelf: 'flex-end', marginBottom: 16, marginTop: -4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ color: '#6366F1', fontSize: 13, fontWeight: '700' }}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Sign In button */}
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1D4ED8', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.signInBtnText}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Create account */}
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => router.push('/signup')}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.createBtnText}>Create an Account</Text>
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

  // Sign In
  signInBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  signInBtnGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  // Create account
  createBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  createBtnText: { color: '#1E293B', fontSize: 15, fontWeight: '700' },
});