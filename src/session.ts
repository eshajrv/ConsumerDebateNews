import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "practify.userId";

export const getSavedUserId = () => AsyncStorage.getItem(KEY);

export const saveUserId = (userId: string) => AsyncStorage.setItem(KEY, userId);

export const clearUserId = () => AsyncStorage.removeItem(KEY);

export function useSavedUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    getSavedUserId().then(setUserId);
  }, []);
  return userId;
}
