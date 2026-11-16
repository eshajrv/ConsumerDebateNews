import { router } from "expo-router";
import { useState } from "react";

import { useRedeemLink } from "./data";
import { saveUserId } from "./session";

export function useJoinWithCode() {
  const redeem = useRedeemLink();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(code: string) {
    setJoining(true);
    setError(null);
    try {
      const { userId, roomId } = await redeem({ code: code.trim() });
      await saveUserId(userId);
      router.replace(`/room/${roomId}`);
    } catch {
      setError("That password didn't work. Check it and try again.");
      setJoining(false);
    }
  }

  return { join, joining, error };
}
