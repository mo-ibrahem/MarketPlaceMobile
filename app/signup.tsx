import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EgbayLogo from '../assets/images/egbay.svg';
import { auth } from '../src/services/lib/supabase';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter a valid email and password.");
      return;
    }
    setLoading(true);
    const name = email.split('@')[0];
    const { error } = await auth.signUp(email, password, name);
    
    if (error) {
      Alert.alert("Sign Up Failed", error.message);
    } else {
      Alert.alert("Success!", "Account created. You can now log in.");
      router.back(); // Sends them back to the login screen after signing up
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <EgbayLogo width={150} height={100} />
          
        </View>

        <TextInput
          style={styles.input}
          placeholder="New Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#9CA3AF"
        />

        <View style={styles.passwordContainer}>
            <TextInput
            style={styles.passwordInput}
            placeholder="Create Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                {showPassword ? <EyeOff color="#9CA3AF" /> : <Eye color="#9CA3AF" />}
            </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.signUpButton]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Register Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.backButton]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginTop: 10 },
  input: { backgroundColor: 'white', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16, marginBottom: 20 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16 },
  eyeIcon: { padding: 14 },
  button: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  signUpButton: { backgroundColor: '#2563EB' }, // Blue for primary action
  backButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E5E7EB' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  backButtonText: { color: '#4B5563', fontSize: 16, fontWeight: '600' },
});