import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Tabs } from "expo-router";
import { House, Video, Tag, Package, User } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";

// Custom Sell tab icon — gradient pill with "SELL" label
function SellTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={styles.sellIconWrap}>
      <LinearGradient
        colors={focused ? ['#1D4ED8', '#7C3AED'] : ['#6366F1', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sellPill}
      >
        <Tag color="white" size={14} />
        <Text style={styles.sellPillText}>SELL</Text>
      </LinearGradient>
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();

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
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          elevation: 20,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: 'white',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <House color={color} size={22} />,
        }}
      />

      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative' }}>
              <Video color={focused ? '#EF4444' : color} size={22} />
              <View style={styles.liveIndicatorDot} />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 10,
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
          tabBarIcon: ({ focused }) => <SellTabIcon focused={focused} />,
          tabBarLabel: () => null,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
            elevation: 20,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            height: 64,
            paddingBottom: 8,
            paddingTop: 6,
            backgroundColor: 'white',
          },
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <Package color={color} size={22} />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sellIconWrap: {
    marginBottom: 4,
    alignItems: 'center',
  },
  sellPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  sellPillText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
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
