import { View, Text, SafeAreaView, ScrollView, RefreshControl } from "react-native";
import { useState, useCallback } from "react";

export default function HomeScreen() {
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff9900" colors={["#ff9900"]} />
        }
      >
        <View className="flex-1 justify-center items-center py-20">
          <Text className="text-white font-display text-2xl">Home Screen</Text>
          <Text className="text-zinc-400 mt-2">Welcome to Standoff 2 League</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
