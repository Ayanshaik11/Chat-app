import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

/** Three bouncing dots in a small bubble: "<name> is typing". */
export default function TypingDots({ name, theme }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  const bubbleBg = theme?.incomingBubbleColor || '#1A1A1A';
  const bubbleBorder = theme?.borderColor || '#292929';
  const dotColor = theme?.accentColor || '#B5B5B5';
  const label = theme?.timestampColor || '#8F8F8F';

  useEffect(() => {
    const loops = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, {
            toValue: 1,
            duration: 330,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 330,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((2 - index) * 160 + 200),
        ])
      )
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, []);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 6,
        paddingBottom: 4,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: bubbleBg,
          borderWidth: 1,
          borderColor: bubbleBorder,
          borderRadius: 16,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        {dots.map((value, index) => (
          <Animated.View
            key={index}
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: dotColor,
              marginHorizontal: 2.5,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
              transform: [
                { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
              ],
            }}
          />
        ))}
      </View>

      {!!name && (
        <Text style={{ color: label, fontSize: 12, marginLeft: 8 }} numberOfLines={1}>
          {name} is typing
        </Text>
      )}
    </View>
  );
}
