import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { addReelComment, deleteReelComment, subscribeReelComments } from '../services/reelComments';
import { addNotification } from '../services/notifications';
import { timeAgo } from '../utils/helpers';

const BG = '#171717';
const BORDER = '#292929';
const MUTED = '#8F8F8F';

export default function ReelCommentsSheet({ reel, me, visible, onClose, onCount }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;

  useEffect(() => {
    if (!visible || !reel?.id) return undefined;
    setLoading(true);
    setComments([]);
    const unsub = subscribeReelComments(reel.id, (list) => {
      setComments(list);
      setLoading(false);
      onCountRef.current?.(reel.id, list.length);
    });
    return unsub;
  }, [visible, reel?.id]);

  const send = async () => {
    const clean = text.trim();
    if (!clean || sending || !me?.id || !reel?.id) return;
    setSending(true);
    try {
      await addReelComment(reel.id, me, clean);
      setText('');
      if (reel.authorId && reel.authorId !== me.id) {
        addNotification(reel.authorId, {
          type: 'comment',
          fromId: me.id,
          fromName: me.name || '',
          fromPhoto: me.photoURL || '',
          text: `${me.name || 'Someone'} commented on your reel: ${clean.slice(0, 60)}`,
        }).catch(() => {});
      }
    } catch (e) {
      Alert.alert('Comment failed', e?.message || 'Could not post your comment.');
    } finally {
      setSending(false);
    }
  };

  const remove = (c) =>
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteReelComment(reel.id, c.id).catch((e) => Alert.alert('Error', e?.message || 'Could not delete.')),
      },
    ]);

  const renderItem = ({ item: c }) => {
    const canDelete = c.authorId === me?.id || reel?.authorId === me?.id;
    return (
      <Pressable
        onLongPress={canDelete ? () => remove(c) : undefined}
        style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8 }}
      >
        <Avatar uri={c.authorPhoto} name={c.authorName} size={34} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
            {c.authorName || 'User'}{' '}
            <Text style={{ color: MUTED, fontWeight: '400', fontSize: 11 }}>{c.createdAt ? timeAgo(c.createdAt) : 'now'}</Text>
          </Text>
          <Text style={{ color: '#fff', fontSize: 14, marginTop: 2 }}>{c.text}</Text>
        </View>
        {canDelete && (
          <Pressable onPress={() => remove(c)} hitSlop={8} style={{ paddingLeft: 8 }}>
            <Ionicons name="trash-outline" size={17} color={MUTED} />
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ height: 480, backgroundColor: BG, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Comments</Text>
            </View>

            {loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={{ color: MUTED, textAlign: 'center', marginTop: 40 }}>No comments yet — be the first!</Text>
                }
              />
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 10,
                borderTopWidth: 1,
                borderTopColor: BORDER,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Add a comment…"
                placeholderTextColor={MUTED}
                maxLength={500}
                style={{
                  flex: 1,
                  color: '#fff',
                  backgroundColor: '#0f0f0f',
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  fontSize: 14,
                }}
              />
              <Pressable
                onPress={send}
                disabled={!text.trim() || sending}
                style={{
                  marginLeft: 8,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: text.trim() ? '#E11D2A' : '#333',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
