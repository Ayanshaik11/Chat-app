import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { acceptRequest, cancelRequest, removeFriend, sendRequest } from '../services/friends';
import Btn from './Btn';

// One button that shows the right action: Add friend / Requested / Accept / Friends
export default function RelationButton({ user, small = true, style }) {
  const { me } = useAuth();
  const { relationTo, incoming } = useAppData();
  const [busy, setBusy] = useState(false);
  const rel = relationTo(user.id);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (rel === 'friend') {
    return (
      <Btn
        small={small} variant="soft" icon="checkmark" label="Friends" style={style} loading={busy}
        onPress={() =>
          Alert.alert('Remove friend?', `${user.name} will be removed from your friends.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => run(() => removeFriend(me.id, user.id)) },
          ])
        }
      />
    );
  }
  if (rel === 'incoming') {
    return (
      <Btn
        small={small} icon="checkmark" label="Accept" style={style} loading={busy}
        onPress={() => run(() => acceptRequest(me, incoming.find((r) => r.from === user.id)))}
      />
    );
  }
  if (rel === 'outgoing') {
    return (
      <Btn
        small={small} variant="soft" label="Requested" style={style} loading={busy}
        onPress={() => run(() => cancelRequest(me.id, user.id))}
      />
    );
  }
  return (
    <Btn
      small={small} icon="person-add-outline" label="Add friend" style={style} loading={busy}
      onPress={() => run(() => sendRequest(me, user))}
    />
  );
}
