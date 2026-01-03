import React, { useState } from "react";
import { View, Text, TouchableOpacity, ImageBackground, Modal, ActivityIndicator, Image } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { getDiscordLoginUrl } from "../src/utils/auth";
import { FRONTEND_URL } from "../src/lib/constants";
import { storage } from "../src/lib/storage";
import { ArrowRight, Gamepad2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthScreen() {
  const [authUrl, setAuthUrl] = useState(getDiscordLoginUrl());
  const [showWebView, setShowWebView] = useState(false);
  const webViewRef = React.useRef<WebView>(null);
  const router = useRouter();

  const handleLogin = () => {
    setAuthUrl(getDiscordLoginUrl());
    setShowWebView(true);
  };

  const handleWebViewNavigationStateChange = async (newNavState: any) => {
    const { url } = newNavState;
    if (!url) return;

    // Check if we are redirected to the frontend application (localhost:5173 or production url)
    // We check for both because backend might redirect to 'localhost' explicitly which Android WebView sees but acts on 10.0.2.2 context
    if (url.startsWith(FRONTEND_URL) || url.startsWith("http://localhost:5173") || url.startsWith("http://127.0.0.1:5173")) {
      // Parse params
      const paramsIdx = url.indexOf("?");
      if (paramsIdx > -1) {
        const queryParams = url.substring(paramsIdx + 1);
        const params = new URLSearchParams(queryParams);
        const id = params.get("id");
        const username = params.get("username");
        
        if (id && username) {
          // Construct user object similar to frontend
          const user = {
             id, 
             username, 
             avatar: params.get("avatar") || "",
             role: params.get("role") || 'user',
             elo: params.get("elo") ? parseInt(params.get("elo")!) : 1000,
             is_vip: params.get("is_vip") === '1' ? 1 : 0,
             vip_until: params.get("vip_until") || undefined,
             is_discord_member: params.get("is_discord_member") === 'true',
             created_at: params.get("created_at") || undefined
          };
          
          await storage.setItem("user", JSON.stringify(user));
          setShowWebView(false);
          router.replace("/");
        }
      }
    }
  };

  const onShouldStartLoadWithRequest = (request: any) => {
      if (request.url.startsWith(FRONTEND_URL) || request.url.includes("localhost:5173") || request.url.includes("127.0.0.1:5173")) {
          handleWebViewNavigationStateChange({ url: request.url });
          return false; 
      }
      return true;
  };

  const onReceivedError = (e: any) => {
      const failingUrl = e.nativeEvent.url;
      console.log("WebView Error:", failingUrl, e.nativeEvent.description);
      
      // 1. Success Redirect but failed to load because localhost
      if (failingUrl && (failingUrl.startsWith(FRONTEND_URL) || failingUrl.includes("localhost:5173") || failingUrl.includes("127.0.0.1:5173"))) {
          handleWebViewNavigationStateChange({ url: failingUrl });
          return;
      }

      // 2. The Backend Callback (localhost:8787) failed to load.
      if (failingUrl && failingUrl.includes("localhost:8787")) {
          const newUrl = failingUrl.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
          console.log("Redirecting localhost failure to:", newUrl);
          
          // Use injectJavaScript to navigate instead of changing source
          if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                  window.location.href = "${newUrl}";
                  true;
              `);
          }
      }
  };

  return (
    <ImageBackground 
      source={require("../assets/login_bg.png")} 
      className="flex-1 bg-black"
      resizeMode="cover"
    >
      <View className="absolute inset-0 bg-black/80" />
      
      <SafeAreaView className="flex-1 flex justify-center px-8 relative z-10">
        <View className="space-y-6">
            <View className="items-center mb-8">
                 <Text className="text-orange-500 font-bold text-lg mb-2 tracking-widest">ШИНЭ ШИНЭЧЛЭЛТ V2.0</Text>
                 <Text className="text-white text-6xl font-display font-black text-center italic leading-tight">
                    STANDOFF 2 <Text className="text-orange-500">LEAGUE</Text>
                 </Text>
                 <Text className="text-zinc-400 text-center text-lg mt-4 font-body">
                    Монголын хамгийн том Standoff 2 тэмцээний платформ.
                 </Text>
            </View>

            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleLogin}
                className="bg-[#5865F2] w-full py-4 rounded-xl flex-row items-center justify-center shadow-lg shadow-blue-500/20"
            >
                <Gamepad2 color="white" size={24} style={{ marginRight: 12 }} />
                <Text className="text-white font-bold text-lg">DISCORD-ООР НЭВТРЭХ</Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={showWebView} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-[#1a1a1a]">
            <WebView
                ref={webViewRef}
                source={{ uri: authUrl }}
                onNavigationStateChange={handleWebViewNavigationStateChange}
                onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
                onError={onReceivedError}
                startInLoadingState
                renderLoading={() => <ActivityIndicator color="#ff9900" size="large" className="absolute top-1/2 left-1/2" />}
                incognito={true}
            />
        </View>
      </Modal>
    </ImageBackground>
  );
}
