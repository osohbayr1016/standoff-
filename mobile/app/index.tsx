import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { storage } from "../src/lib/storage";
import { useRouter } from "expo-router";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);
  const router = useRouter();

  useEffect(() => {
    storage.getItem("user").then((user) => {
      setHasUser(!!user);
      setLoading(false);
    });
  }, []);

  if (loading) return <View className="flex-1 bg-background justify-center items-center"><ActivityIndicator color="#ff9900"/></View>;

  if (!hasUser) {
    return <Redirect href="/auth" />;
  }

  return <Redirect href="/(tabs)" />;
}
