import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../context/SettingsContext';
import KingXAIAvatar from './KingXAIAvatar';
import T from './T';

const WORDS = ['Thinking', 'Working on it', 'Putting it together'];

// "Thinking..." effect: pulsing avatar, bouncing dots and a status line that changes
export default function KingXAIThinking() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const [word, setWord] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const bounce = Animated.loop(
      Animated.stagger(
        160,
        dots.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.delay(300),
          ])
        )
      )
    );
    loop.start();
    bounce.start();
    const timer = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2200);
    return () => { loop.stop(); bounce.stop(); clearInterval(timer); };
  }, [pulse, dots]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
      <Animated.View style={{ transform: [{ scale }], opacity: glow }}>
        <KingXAIAvatar size={30} />
      </Animated.View>
      <T size={13} color="subtext" weight="medium">{WORDS[word]}</T>
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={{
              width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary,
              opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            }}
          />
        ))}
      </View>
    </View>
  );
}
