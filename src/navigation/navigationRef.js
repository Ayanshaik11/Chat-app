import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigateToChat(user, currentUser = null) {
  if (!navigationRef.isReady() || !user?.id) {
    return;
  }

  if (!currentUser?.id) {
    console.log(
      'navigateToChat: missing current user. Chat navigation skipped.'
    );
    return;
  }

  navigationRef.navigate('Chat', {
    user: currentUser,
    otherUser: {
      id: user.id,
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
    },
  });
}
