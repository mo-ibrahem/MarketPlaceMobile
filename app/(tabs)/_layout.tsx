import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Tabs } from "expo-router";
import { House, Tag, User } from "lucide-react-native";
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
        <Tag color="white" size={15} />
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
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 24,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: 'white',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
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
            borderTopWidth: 0,
            elevation: 24,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
            backgroundColor: 'white',
          },
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sellIconWrap: {
    marginBottom: 6,
    alignItems: 'center',
  },
  sellPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  sellPillText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
