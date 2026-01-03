import { Tabs } from "expo-router";
import { Home, User, Users, Swords } from "lucide-react-native";
import { View, Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#050505",
          borderTopWidth: 1,
          borderTopColor: "#1a1a1a",
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarActiveTintColor: "#ff9900",
        tabBarInactiveTintColor: "#666",
        tabBarLabelStyle: {
           fontFamily: "Inter_500Medium",
           fontSize: 10,
           marginTop: 5
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="matchmaking"
        options={{
          title: "Match",
          tabBarIcon: ({ color }) => <Swords color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="clans"
        options={{
          title: "Clans",
          tabBarIcon: ({ color }) => <Users color={color} size={24} />,
        }}
      />
       <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
