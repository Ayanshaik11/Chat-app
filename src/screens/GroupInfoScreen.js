import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import useGroupMembers from '../hooks/useGroupMembers';
import { mimeOf, pickMedia, uploadFile } from '../services/media';
import {
  MAX_GROUP_MEMBERS, MAX_GROUP_NAME, addMembers, dismissAdmin, leaveGroup, makeAdmin, removeGroupPhoto, removeMember, renameGroup, setGroupPhoto,
} from '../services/groups';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import GroupAvatar from '../components/GroupAvatar';
import T from '../components/T';

const nameOf = (p) => p?.name || p?.displayName || 'User';
const photoOf = (p) => p?.photoURL || p?.photoUrl || p?.profilePic || p?.avatar || '';

export default function GroupInfoScreen({ route, navigation }) {
  const { groupId } = route.params || {};
  const { me } = useAuth();
  const { friends } = useAppData();
  const { colors, fonts } = useTheme();
  const myId = me?.id;

  const [chat, setChat] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    if (!groupId) return undefined;
    return onSnapshot(
      doc(db, 'chats', groupId),
      (s) => { setChat(s.exists() ? { id: s.id, ...s.data() } : null); setLoaded(true); },
      () => { setChat(null); setLoaded(true); }
    );
  }, [groupId]);

  const members = chat?.members || [];
  const admins = chat?.admins || [];
  const profiles = useGroupMembers(members);
  const iAmMember = members.includes(myId);
  const iAmAdmin = admins.includes(myId);

  // admins first, then me, then the rest by name
  const ordered = useMemo(
    () =>
      members
        .map((id) => ({ id, profile: profiles[id] || { id, name: 'Member' } }))
        .sort((a, b) => {
          const rank = (x) => (admins.includes(x.id) ? 0 : x.id === myId ? 1 : 2);
          return rank(a) - rank(b) || nameOf(a.profile).localeCompare(nameOf(b.profile));
        }),
    [members, admins, profiles, myId]
  );

  const addable = useMemo(() => friends.filter((f) => f.id && !members.includes(f.id)), [friends, members]);

  const guard = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert('Something went wrong', e?.message || 'Please try again.'); }
    setBusy(false);
  };

  // tapping the camera: choose a new photo, or remove the current one
  const photoMenu = () => {
    if (!chat?.photoURL) { changePhoto(); return; }
    Alert.alert('Group photo', undefined, [
      { text: 'Change photo', onPress: changePhoto },
      { text: 'Remove photo', style: 'destructive', onPress: () => guard(() => removeGroupPhoto(groupId, me)) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const changePhoto = () =>
    guard(async () => {
      const photo = await pickMedia({ source: 'gallery', square: true });
      if (!photo) return;
      const url = await uploadFile(photo.uri, `groups/${groupId}/${Date.now()}.jpg`, mimeOf(photo));
      await setGroupPhoto(groupId, me, url);
    });

  const saveName = () =>
    guard(async () => {
      await renameGroup(groupId, me, nameDraft);
      setRenameOpen(false);
    });

  const doAdd = () =>
    guard(async () => {
      const people = picked.map((id) => ({ id, name: nameOf(friends.find((f) => f.id === id)) }));
      await addMembers(groupId, me, members, people);
      setAddOpen(false);
      setPicked([]);
    });

  const memberActions = (m) => {
    const isMe = m.id === myId;
    const isAdmin = admins.includes(m.id);
    const buttons = [];
    if (!isMe) buttons.push({ text: 'View profile', onPress: () => navigation.navigate('UserProfile', { userId: m.id }) });
    if (iAmAdmin && !isMe) {
      buttons.push(
        isAdmin
          ? { text: 'Remove as admin', onPress: () => guard(() => dismissAdmin(groupId, { id: m.id })) }
          : { text: 'Make admin', onPress: () => guard(() => makeAdmin(groupId, me, { id: m.id, name: nameOf(m.profile) })) }
      );
      buttons.push({
        text: 'Remove from group',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Remove from group?', `${nameOf(m.profile)} will no longer see new messages.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => guard(() => removeMember(groupId, me, { id: m.id, name: nameOf(m.profile) })) },
          ]),
      });
    }
    if (!buttons.length) return;
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(nameOf(m.profile), isAdmin ? 'Group admin' : 'Group member', buttons);
  };

  const leave = () =>
    Alert.alert('Leave group?', 'You will stop receiving messages from this group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          guard(async () => {
            await leaveGroup(chat, me);
            navigation.popToTop();
          }),
      },
    ]);

  if (loaded && (!chat || !iAmMember)) {
    return (
      <Screen>
        <ScreenHeader title="Group info" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <T color="subtext" style={{ textAlign: 'center' }}>You are no longer a member of this group.</T>
        </View>
      </Screen>
    );
  }

  const Row = ({ icon, label, onPress, danger, right }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 14, backgroundColor: pressed ? colors.inputBg : 'transparent' })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger || '#E11D2A' : colors.primary} />
      </View>
      <T weight="medium" color={danger ? 'danger' : undefined} style={{ flex: 1 }}>{label}</T>
      {right}
    </Pressable>
  );

  return (
    <Screen>
      <ScreenHeader title="Group info" onBack={() => navigation.goBack()} right={busy ? <ActivityIndicator color={colors.primary} style={{ marginRight: 10 }} /> : null} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', paddingTop: 22, paddingBottom: 12, paddingHorizontal: 20 }}>
          <Pressable onPress={photoMenu}>
            <GroupAvatar uri={chat?.photoURL} size={96} badge={false} />
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg }}>
              <Ionicons name="camera" size={15} color="#fff" />
            </View>
          </Pressable>
          <Pressable onPress={() => { setNameDraft(chat?.name || ''); setRenameOpen(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, maxWidth: '90%' }}>
            <T weight="bold" size={22} numberOfLines={2} style={{ textAlign: 'center', flexShrink: 1 }}>{chat?.name || 'Group'}</T>
            <Ionicons name="pencil" size={16} color={colors.subtext} />
          </Pressable>
          <T color="subtext" size={13} style={{ marginTop: 2 }}>{`Group · ${members.length} ${members.length === 1 ? 'member' : 'members'}`}</T>
        </View>

        <Row icon="person-add" label="Add people" onPress={() => { setPicked([]); setAddOpen(true); }} />

        <T size={11} weight="semibold" color="subtext" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Members
        </T>
        {ordered.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => memberActions(m)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, gap: 12, backgroundColor: pressed ? colors.inputBg : 'transparent' })}
          >
            <Avatar uri={photoOf(m.profile)} name={nameOf(m.profile)} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T weight="semibold" numberOfLines={1}>{nameOf(m.profile)}{m.id === myId ? ' (You)' : ''}</T>
              {m.profile?.username ? <T size={12} color="subtext" numberOfLines={1}>{`@${m.profile.username}`}</T> : null}
            </View>
            {admins.includes(m.id) ? (
              <View style={{ borderRadius: 8, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2 }}>
                <T size={11} weight="semibold" color="primary">Admin</T>
              </View>
            ) : null}
          </Pressable>
        ))}

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
        <Row icon="exit-outline" label="Leave group" danger onPress={leave} />
      </ScrollView>

      {/* rename */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <Pressable onPress={() => setRenameOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'center', padding: 24 }}>
          <Pressable style={{ backgroundColor: colors.card, borderRadius: 20, padding: 18 }}>
            <T weight="bold" size={17} style={{ marginBottom: 12 }}>Group name</T>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              maxLength={MAX_GROUP_NAME}
              autoFocus
              placeholder="Group name"
              placeholderTextColor={colors.subtext}
              style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => setRenameOpen(false)} style={{ paddingHorizontal: 16, height: 40, justifyContent: 'center' }}>
                <T color="subtext" weight="medium">Cancel</T>
              </Pressable>
              <Pressable onPress={saveName} disabled={!nameDraft.trim() || busy} style={{ paddingHorizontal: 20, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', opacity: !nameDraft.trim() || busy ? 0.5 : 1 }}>
                <T color="#fff" weight="semibold">Save</T>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* add people */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setAddOpen(false)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '80%' }}>
            <T weight="bold" size={18} style={{ marginBottom: 8 }}>Add people</T>
            {!addable.length ? (
              <T color="subtext" style={{ textAlign: 'center', paddingVertical: 40 }}>All your friends are already in this group.</T>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {addable.map((f) => {
                  const on = picked.includes(f.id);
                  return (
                    <Pressable key={f.id} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id]))} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 }}>
                      <Avatar uri={photoOf(f)} name={nameOf(f)} size={42} />
                      <T weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{nameOf(f)}</T>
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {on ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <Pressable
              onPress={doAdd}
              disabled={!picked.length || busy || members.length + picked.length > MAX_GROUP_MEMBERS}
              style={{ height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12, opacity: !picked.length || busy ? 0.5 : 1 }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <T color="#fff" weight="semibold">{`Add${picked.length ? ` (${picked.length})` : ''}`}</T>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
