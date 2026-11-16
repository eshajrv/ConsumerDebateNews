import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "practify.userId";

export const getSavedUserId = () => AsyncStorage.getItem(KEY);

export const saveUserId = (userId: string) => AsyncStorage.setItem(KEY, userId);

export const clearUserId = () => AsyncStorage.removeItem(KEY);

// The lobby or chat you're in, so reopening the app takes you back to it
const ROOM_KEY = "practify.roomId";

export const getSavedRoomId = () => AsyncStorage.getItem(ROOM_KEY);

export const saveRoomId = (roomId: string) => AsyncStorage.setItem(ROOM_KEY, roomId);

export const clearSavedRoomId = () => AsyncStorage.removeItem(ROOM_KEY);

export function useSavedUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    getSavedUserId().then(setUserId);
  }, []);
  return userId;
}
