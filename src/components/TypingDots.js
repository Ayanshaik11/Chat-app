import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

/** Three bouncing dots in a small bubble: "<name> is typing". */
export default function TypingDots({ name }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

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
          backgroundColor: '#1A1A1A',
          borderWidth: 1,
          borderColor: '#292929',
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
              backgroundColor: '#B5B5B5',
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
        <Text style={{ color: '#8F8F8F', fontSize: 12, marginLeft: 8 }} numberOfLines={1}>
          {name} is typing
        </Text>
      )}
    </View>
  );
}
