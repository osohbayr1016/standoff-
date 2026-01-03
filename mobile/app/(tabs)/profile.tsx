import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { storage } from "../../src/lib/storage";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";

export default function Screen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);
  
  const handleLogout = async () => {
    await storage.removeItem("user");
    router.replace("/auth");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff9900" colors={["#ff9900"]} />
        }
      >
         <Text className="text-white mb-4">Profile</Text>
         <TouchableOpacity onPress={handleLogout} className="bg-red-500 px-4 py-2 rounded">
            <Text className="text-white font-bold">Log Out</Text>
         </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
