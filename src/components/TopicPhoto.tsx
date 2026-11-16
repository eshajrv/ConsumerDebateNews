import { Image, StyleSheet, Text, View } from "react-native";

import { colors, radius, type } from "../theme";

type Props = {
  imageUrl?: string;
  category: string;
  height?: number;
  // A dark green fade over the bottom of the photo (the house table card)
  fade?: boolean;
  // Cancels the card's padding so the photo runs edge to edge: pass the card's padding
  bleed?: { top?: number; horizontal?: number };
  // Round all four corners (when the photo isn't the top of a card)
  roundAll?: boolean;
};

const FADE_STEPS = 8;

// Same shape everywhere: full width, cover crop, rounded top corners.
export function TopicPhoto({ imageUrl, category, height = 96, fade, bleed, roundAll }: Props) {
  const shape = [
    styles.wrap,
    { height },
    roundAll && { borderRadius: radius.card },
    bleed && { marginTop: -(bleed.top ?? 0), marginHorizontal: -(bleed.horizontal ?? 0) },
  ];
  if (!imageUrl) {
    return (
      <View style={[shape, styles.empty]}>
        <Text style={[type.category, styles.emptyLabel]}>{category}</Text>
      </View>
    );
  }
  return (
    <View style={shape}>
      <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      {fade && (
        <View style={styles.fade} pointerEvents="none">
          {Array.from({ length: FADE_STEPS }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: colors.feature, opacity: ((i + 1) / FADE_STEPS) ** 1.6 }} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, backgroundColor: colors.feature },
  empty: { alignItems: "center", justifyContent: "center" },
  emptyLabel: { color: colors.featureAccent },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
});
