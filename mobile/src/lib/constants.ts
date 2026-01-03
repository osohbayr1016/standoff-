import { Platform } from "react-native";

export const BACKEND_URL = Platform.OS === 'android' ? "http://10.0.2.2:8787" : "http://localhost:8787";
export const FRONTEND_URL = Platform.OS === 'android' ? "http://10.0.2.2:5173" : "http://localhost:5173";
