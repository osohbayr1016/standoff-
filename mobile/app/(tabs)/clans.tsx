import { View, Text, SafeAreaView, ScrollView, RefreshControl } from "react-native";
import { useState, useCallback } from "react";

export default function Screen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff9900" colors={["#ff9900"]} />
        }
      >
        <Text className="text-white">Clans Coming Soon</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
