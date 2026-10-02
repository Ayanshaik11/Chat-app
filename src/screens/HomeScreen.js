import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        KING X
      </Text>

      <Text style={styles.subtitle}>
        Home
      </Text>

      <Text style={styles.text}>
        Welcome to King X
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: '#E11D2A',
    fontSize: 36,
    fontWeight: '800',
  },

  subtitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 10,
  },

  text: {
    color: '#888888',
    fontSize: 14,
    marginTop: 8,
  },
});