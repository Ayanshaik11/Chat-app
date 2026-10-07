import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import Avatar from './Avatar';
import { sendMessage } from '../services/chat';
import { sendPushNotification } from '../services/notifications';

const BG = '#171717';
const BORDER = '#292929';
const MUTED = '#8F8F8F';

/** Sends the reel link to a friend as a normal King X chat message. */
export default function ReelShareSheet({ visible, onClose, me, friends = [], text }) {
  const [sent, setSent] = useState({});
  const [busy, setBusy] = useState({});

  useEffect(() => {
    if (visible) {
      setSent({});
      setBusy({});
    }
  }, [visible]);

  const send = async (friend) => {
    if (!me?.id || !friend?.id || busy[friend.id] || sent[friend.id]) return;
    setBusy((b) => ({ ...b, [friend.id]: true }));
    try {
      await sendMessage(me.id, friend.id, text);
      sendPushNotification({
        toUserId: friend.id,
        title: me.name || 'New message',
        body: 'Shared a video with you',
        data: { type: 'message', fromId: me.id, fromName: me.name || '', fromPhoto: me.photoURL || '' },
      }).catch(() => {});
      setSent((s) => ({ ...s, [friend.id]: true }));
    } catch (e) {
      Alert.alert('Share failed', e?.message || 'Could not send.');
    } finally {
      setBusy((b) => ({ ...b, [friend.id]: false }));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ height: 460, backgroundColor: BG, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <View style={{ alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Share with friends</Text>
          </View>
          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            ListEmptyComponent={
              <Text style={{ color: MUTED, textAlign: 'center', marginTop: 40 }}>Add some friends to share videos with them.</Text>
            }
            renderItem={({ item: f }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
                <Avatar uri={f.photoURL} name={f.name} size={44} />
                <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 12 }} numberOfLines={1}>
                  {f.name || 'User'}
                </Text>
                <Pressable
                  onPress={() => send(f)}
                  disabled={!!sent[f.id] || !!busy[f.id]}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 8,
                    borderRadius: 18,
                    backgroundColor: sent[f.id] ? '#333' : '#E11D2A',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {sent[f.id] ? 'Sent' : busy[f.id] ? '…' : 'Send'}
                  </Text>
                </Pressable>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
