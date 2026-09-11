import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Tabs } from "expo-router";
import { House, Video, Plus, Package, User } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../src/i18n/LanguageContext";
import { color, font, space, weight } from "../../src/design/tokens";

// Custom Sell tab icon — floating action button matching the web app
function SellTabIcon({ label }: { label: string }) {
  return (
    <View style={styles.sellIconWrap}>
      <LinearGradient
        colors={[color.primary, color.accentAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabCircle}
      >
        <Plus color="white" size={28} strokeWidth={2.5} />
      </LinearGradient>
      <Text style={styles.fabText}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  // Tab labels are the most-read text in the app and were English-only, on an
  // app that ships a language switcher for an Egyptian market.
  const L = isRTL
    ? { home: 'الرئيسية', live: 'بث مباشر', sell: 'بيع', orders: 'الطلبات', profile: 'حسابي' }
    : { home: 'Home', live: 'Live', sell: 'Sell', orders: 'Orders', profile: 'Profile' };

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
        tabBarActiveTintColor: color.primary,
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
          // gap between them: about 40pt. 50 leaves a little air and keeps the
          // floating Sell button's own label clear of the home indicator --
          // that FAB is 56pt tall and deliberately overhangs the bar, so the
          // bar cannot be trimmed all the way down to the other tabs' content.
          // The indicator's inset is added on top and reserved as padding, so
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

      <Tabs.Screen
        name="live"
        options={{
          title: L.live,
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

      {/* Sell tab with pill CTA */}
      <Tabs.Screen
        name="sell"
        options={{
          title: "",
          tabBarIcon: () => <SellTabIcon label={L.sell} />,
          tabBarLabel: () => null,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#EEF2FF',
            elevation: 24,
            shadowColor: '#1E293B',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.08,
            shadowRadius: 20,
            height: 68,
            paddingBottom: 10,
            paddingTop: 6,
            backgroundColor: 'rgba(255,255,255,0.98)',
          },
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: L.orders,
          tabBarIcon: ({ color, size }) => <Package color={color} size={22} />,
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
  sellIconWrap: {
    top: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#3665F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    color: '#3665F3',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
  },
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
