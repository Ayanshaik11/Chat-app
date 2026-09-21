import React from 'react';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import ProfileView from './ProfileView';

export default function UserProfileScreen({ route, navigation }) {
  return (
    <Screen>
      <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
      <ProfileView userId={route.params.userId} navigation={navigation} />
    </Screen>
  );
}
