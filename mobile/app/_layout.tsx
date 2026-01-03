import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Rajdhani_400Regular, Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold } from "@expo-google-fonts/rajdhani";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from "react";
import { WebSocketProvider } from "../src/context/WebSocketContext";
import { BACKEND_URL } from "../src/lib/constants";

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [loaded, error] = useFonts({
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <WebSocketProvider url={BACKEND_URL}>
        <View className="flex-1 bg-background">
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#050505" },
            }}
          />
          <StatusBar style="light" />
        </View>
      </WebSocketProvider>
    </SafeAreaProvider>
  );
}
