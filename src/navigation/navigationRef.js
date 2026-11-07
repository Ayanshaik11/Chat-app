import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigateToGroup(groupId, groupName, currentUser) {
  if (!navigationRef.isReady() || !groupId || !currentUser?.id) {
    return;
  }

  navigationRef.navigate('Chat', {
    user: currentUser,
    groupId,
    groupName: groupName || 'Group',
  });
}

export function navigateToChat(user, currentUser) {
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
