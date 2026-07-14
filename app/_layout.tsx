// Initialize i18next before anything else renders
import '../src/i18n';

import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import { LanguageProvider } from '../src/i18n/LanguageContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="products" options={{ title: 'Products' }} />
        <Stack.Screen name="products/[id]" options={{ title: 'Product Details' }} />
        <Stack.Screen name="products/edit/[id]" options={{ title: 'Edit Product' }} />
        <Stack.Screen name="chat/[roomId]" options={{ title: 'Chat' }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="payment" options={{ title: 'Complete Payment' }} />
      </Stack>
      <Toast />
    </LanguageProvider>
  );
}