import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Tabs } from "expo-router";
import { House, Video, Plus, Package, User } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";

// Custom Sell tab icon — floating action button matching the web app
function SellTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={styles.sellIconWrap}>
      <LinearGradient
        colors={['#3665F3', '#5B3DDB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabCircle}
      >
        <Plus color="white" size={28} strokeWidth={2.5} />
      </LinearGradient>
      <Text style={styles.fabText}>Sell</Text>
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
        tabBarActiveTintColor: "#3665F3",
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
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
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.1,
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
    fontSize: 10,
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
