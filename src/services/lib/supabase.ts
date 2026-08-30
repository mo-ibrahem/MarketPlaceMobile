// ADDED: These imports are required for Supabase to work in React Native
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import 'react-native-url-polyfill/auto'

import { Platform } from 'react-native'

// ADDED: Platform-aware storage adapter that uses SecureStore on Native and localStorage on Web
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key)
      }
      return null
    }
    return SecureStore.getItemAsync(key)
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value)
      }
      return
    }
    SecureStore.setItemAsync(key, value)
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key)
      }
      return
    }
    SecureStore.deleteItemAsync(key)
  },
}

// UPDATED: Environment variables now use the EXPO_PUBLIC_ prefix
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// UPDATED: The createClient call now uses the native storage adapter
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// KEPT: All your useful helper functions are still here!
export const auth = {
  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })
    return { data, error }
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  // MODIFIED: signInWithGoogle is temporarily disabled.
  // It requires a different setup on mobile using Expo's AuthSession.
  // We can add this back later.
  /*
  signInWithGoogle: async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      return { data, error }
    } catch (error) {
      console.error("Google sign in error:", error)
      return { data: null, error }
    }
  },
  */

  resetPasswordForEmail: async (email: string, redirectTo?: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || 'https://egbay.market/reset-password',
    });
    return { data, error };
  },

  updatePassword: async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  getCurrentUser: async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    return { user, error }
  },

  supabase, // You can keep this export if you need direct access
}