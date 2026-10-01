import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigateToChat(user) {
  if (!navigationRef.isReady() || !user?.id) return;
  navigationRef.navigate('Chat', { user });
}
