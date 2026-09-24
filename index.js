import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';

// Load the app inside try/catch so a start-up crash shows its message on screen
// instead of leaving you stuck on the splash logo.
let App = null;
let loadError = null;
try {
  App = require('./App').default;
} catch (e) {
  loadError = e;
}

function Root() {
  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', paddingTop: 60, paddingHorizontal: 16, paddingBottom: 20 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Chat App failed to start</Text>
        <Text style={{ color: '#E11D2A', marginTop: 6 }}>Send a screenshot of this screen to fix it.</Text>
        <ScrollView style={{ marginTop: 14 }}>
          <Text selectable style={{ color: '#fff', fontSize: 12 }}>
            {String((loadError && loadError.stack) || loadError)}
          </Text>
        </ScrollView>
      </View>
    );
  }
  return <App />;
}

registerRootComponent(Root);
