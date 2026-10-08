import React, { createContext, useContext, useState } from "react";
import { Pressable, Text, StyleSheet, Platform } from "react-native";
export const ActionControlsContext = createContext({
  busy: false,
  text: "#19382F",
  muted: "#526B60",
});
// Stable component identity preserves focused quick replies when review state changes.
export function ActionButton({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const p = useContext(ActionControlsContext),
    [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || p.busy}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        primary ? styles.primary : { borderColor: p.muted },
        (disabled || p.busy) && { opacity: 0.45 },
        focused &&
          (Platform.OS === "web"
            ? {
                outlineColor: p.text,
                outlineWidth: 3,
                outlineStyle: "solid",
                outlineOffset: 2,
              }
            : { borderWidth: 2, borderColor: p.text }),
      ]}
    >
      <Text
        style={{
          color: primary ? "#FFFFFF" : p.text,
          fontWeight: "600",
          fontSize: 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: "#28664E", borderColor: "#28664E" },
});
