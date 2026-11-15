import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "practify.userId";

export const getSavedUserId = () => AsyncStorage.getItem(KEY);

export const saveUserId = (userId: string) => AsyncStorage.setItem(KEY, userId);

export const clearUserId = () => AsyncStorage.removeItem(KEY);
