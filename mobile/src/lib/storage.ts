import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.error(e);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error(e);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error(e);
    }
  },
};
