// Initialize i18next before anything else renders
import '../src/i18n';

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import { LanguageProvider } from '../src/i18n/LanguageContext';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'egbay-web-page-transitions';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          @keyframes pageSlideFadeIn {
            0% {
              opacity: 0;
              transform: translateY(10px) scale(0.995);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          /* Smoothly animate screen switches on web */
          .r-flex-1[data-testid="page-container"],
          div[style*="position: absolute"][style*="inset: 0"],
          div[style*="position: absolute"][style*="top: 0"][style*="left: 0"] {
            animation: pageSlideFadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          /* Smooth interactive transitions */
          button, a, [role="button"] {
            transition: transform 0.12s ease, opacity 0.12s ease;
          }
          [role="button"]:active {
            transform: scale(0.97);
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);
  return (
    <LanguageProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 250,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="products" options={{ title: 'Products' }} />
        <Stack.Screen name="products/[id]" options={{ title: 'Product Details' }} />
        <Stack.Screen name="products/edit/[id]" options={{ title: 'Edit Product' }} />
        <Stack.Screen name="chat/[roomId]" options={{ title: 'Chat' }} />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="signup" options={{ animation: 'fade' }} />
        <Stack.Screen name="payment" options={{ title: 'Complete Payment' }} />
        <Stack.Screen
          name="checkout"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            title: 'Checkout',
          }}
        />
        <Stack.Screen name="wallet" options={{ title: 'My Wallet' }} />
        <Stack.Screen name="order/[orderId]" options={{ title: 'Order Status' }} />
        <Stack.Screen
          name="payout-settings"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            title: 'Payout Settings',
          }}
        />
        <Stack.Screen
          name="seller-verification"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            title: 'Seller Verification',
          }}
        />
        <Stack.Screen
          name="boost/[productId]"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            title: 'Boost Listing',
          }}
        />
      </Stack>
      <Toast />
    </LanguageProvider>
  );
}