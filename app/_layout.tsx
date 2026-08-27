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
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="payment" options={{ headerShown: false, title: 'Complete Payment' }} />
        <Stack.Screen name="checkout" options={{ headerShown: false, title: 'Checkout' }} />
        <Stack.Screen name="wallet" options={{ headerShown: false, title: 'My Wallet' }} />
        <Stack.Screen name="order/[orderId]" options={{ headerShown: false, title: 'Order Status' }} />
        <Stack.Screen name="payout-settings" options={{ headerShown: false, title: 'Payout Settings' }} />
      </Stack>
      <Toast />
    </LanguageProvider>
  );
}