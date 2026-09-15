import { Redirect, Tabs, useFocusEffect } from "expo-router";
import { House, Video, Package, User, MessageCircle, Heart } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../src/i18n/LanguageContext";
import { color, font, space } from "../../src/design/tokens";
import { LIVE_ENABLED, PAYMENTS_ENABLED } from "../../src/services/lib/platformCommerce";
import { getWaitingReplyCount } from "../../src/services/lib/homeActivity";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  // The red count on Chats: conversations whose last message is theirs, so
  // it only ever appears when someone is actually waiting on a reply.
  const [waiting, setWaiting] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!user) { setWaiting(0); return; }
      getWaitingReplyCount().then(setWaiting).catch(() => setWaiting(0));
    }, [user])
  );

  // Tab labels are the most-read text in the app and were English-only, on an
  // app that ships a language switcher for an Egyptian market.
  const L = isRTL
    ? { home: 'الرئيسية', live: 'بث مباشر', saved: 'المحفوظات', orders: 'الطلبات', chats: 'الدردشات', profile: 'حسابي' }
    : { home: 'Home', live: 'Live', saved: 'Saved', orders: 'Orders', chats: 'Chats', profile: 'Profile' };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        // Approved build: the active tab is ink, not the link blue -- every
        // rendered tab-bar example in the design uses #0F172A for the
        // selected icon/label. Blue stays reserved for links and the
        // selected state *within* a screen (category tiles, filters).
        tabBarActiveTintColor: color.action,
        tabBarInactiveTintColor: color.textFaint,
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: color.border,
          elevation: 24,
          shadowColor: color.inkAlt,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
          shadowRadius: 20,
          // Content is a 22pt icon plus an 11pt label (~13pt line box) plus the
          // gap between them: about 40pt. 50 leaves a little air. The home
          // indicator's inset is added on top and reserved as padding, so
          // nothing sits underneath it.
          //
          // Do not add insets.bottom to the height AND also pad by more than
          // the inset -- that was the previous bug here. A 64pt base left ~18pt
          // of slack that rendered as dead space under the labels on a device
          // with a home indicator.
          height: 50 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: space.xs + 2,
          backgroundColor: 'rgba(255,255,255,0.98)',
        },
        tabBarLabelStyle: {
          fontSize: font.caption2,
          fontWeight: '700',
          letterSpacing: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: L.home,
          tabBarIcon: ({ color, size }) => <House color={color} size={22} />,
        }}
      />

      {/* Live has its own switch: it came back before payments did, with
          passes free for now (see LIVE_ENABLED). href: null hides the tab
          without unregistering the route, so a stale link to /live still
          resolves and shows its own guard. */}
      <Tabs.Screen
        name="live"
        options={{
          title: L.live,
          href: LIVE_ENABLED ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative' }}>
              <Video color={focused ? '#EF4444' : color} size={22} />
              <View style={styles.liveIndicatorDot} />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '800',
            color: '#EF4444',
          },
        }}
      />

      {/* Approved build: four flat tabs, Sell moves into the header pill and
          the feed row (see app/(tabs)/index.tsx and app/(tabs)/sell.tsx).
          The route stays registered and reachable -- href: null only drops
          it from the bar, the same pattern the live tab already used. */}
      <Tabs.Screen name="sell" options={{ href: null }} />

      <Tabs.Screen
        name="saved"
        options={{
          title: L.saved,
          tabBarIcon: ({ color, size }) => <Heart color={color} size={22} />,
        }}
      />

      {/* Paused while PAYMENTS_ENABLED is false -- see PLAN-CLASSIFIEDS-MODE.md. */}
      <Tabs.Screen
        name="orders"
        options={{
          title: L.orders,
          href: PAYMENTS_ENABLED ? undefined : null,
          tabBarIcon: ({ color, size }) => <Package color={color} size={22} />,
        }}
      />

      {/* Approved build: Chats is one of the four permanent tabs, not
          something that only exists while payments are paused. */}
      <Tabs.Screen
        name="chats"
        options={{
          title: L.chats,
          tabBarBadge: waiting > 0 ? (waiting > 9 ? '9+' : waiting) : undefined,
          tabBarBadgeStyle: { backgroundColor: color.danger, fontSize: 10, fontWeight: '800' },
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={22} />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: L.profile,
          tabBarIcon: ({ color, size }) => <User color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  liveIndicatorDot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: 'white',
  },
});
