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
          // Was a fixed height/padding, which crowded the home indicator on
          // devices that have one and left dead space on those that do not.
          // 22pt icon + 11pt label + breathing room = 64 of content, then the
          // home indicator on top of that. A fixed 68 crowded the indicator on
          // devices that have one and clipped the label on those that do not.
          height: 64 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, space.xs),
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
