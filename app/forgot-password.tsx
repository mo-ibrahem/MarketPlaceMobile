import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { auth } from '../src/services/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Toast.show({
        type: 'error',
        text1: 'Email Required',
        text2: 'Please enter your email address.',
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

    setLoading(true);
    try {
      const { error } = await auth.resetPasswordForEmail(cleanEmail);
      if (error) {
        Toast.show({
          type: 'error',
          text1: 'Reset Failed',
          text2: error.message,
        });
        if (Platform.OS !== 'web') {
          Alert.alert('Reset Failed', error.message);
        }
      } else {
        setSubmitted(true);
        Toast.show({
          type: 'success',
          text1: 'Link Sent!',
          text2: 'Check your inbox for password reset instructions.',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err?.message || 'Could not send reset email.',
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
            {/* Header Hero */}
            <LinearGradient
              colors={['#1D4ED8', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, { paddingTop: insets.top + 28 }]}
            >
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtnHeader}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={22} color="white" />
              </TouchableOpacity>
              <View style={styles.logoWrap}>
                <Image
                  source={require('../assets/images/egbay_logo_header.png')}
                  style={{ width: 160, height: 50, resizeMode: 'contain' }}
                />
              </View>
              <Text style={styles.heroTagline}>Password Recovery</Text>
              <Text style={styles.heroSub}>Regain access to your EgyBay account</Text>
            </LinearGradient>

            {/* Form Card */}
            <View style={styles.formCard}>
              {submitted ? (
                <View style={styles.successBox}>
                  <CheckCircle2 size={54} color="#10B981" style={{ marginBottom: 14 }} />
                  <Text style={styles.formTitle}>Check your inbox</Text>
                  <Text style={styles.successDesc}>
                    We've sent password reset instructions to{' '}
                    <Text style={{ fontWeight: '700', color: '#1E293B' }}>{email}</Text>. Click the
                    link in the email to set a new password.
                  </Text>
                  <TouchableOpacity
                    style={[styles.signInBtn, { width: '100%', marginTop: 20 }]}
                    onPress={() => router.replace('/login')}
                  >
                    <LinearGradient
                      colors={['#1D4ED8', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.signInBtnGradient}
                    >
                      <Text style={styles.signInBtnText}>Back to Sign In</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.formTitle}>Forgot Password?</Text>
                  <Text style={styles.formSub}>
                    Enter your registered email address to receive a secure password reset link.
                  </Text>

                  {/* Email Input */}
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
                      autoFocus
                    />
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={styles.signInBtn}
                    onPress={handleResetPassword}
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
                        <Text style={styles.signInBtnText}>Send Reset Link</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Back to Login */}
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                    disabled={loading}
                  >
                    <Text style={styles.backBtnText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  hero: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
    position: 'relative',
  },
  backBtnHeader: {
    position: 'absolute',
    left: 20,
    top: 40,
    zIndex: 10,
    padding: 8,
  },
  logoWrap: {
    marginBottom: 8,
  },
  heroTagline: { fontSize: 18, fontWeight: '800', color: 'white', marginBottom: 4, textAlign: 'center' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.72)', textAlign: 'center' },

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
  formSub: { fontSize: 13, color: '#94A3B8', marginBottom: 24, lineHeight: 18 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    height: 54,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#1E293B' },

  signInBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  signInBtnGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

  backBtn: {
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  backBtnText: { color: '#64748B', fontSize: 14, fontWeight: '700' },

  successBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
});
