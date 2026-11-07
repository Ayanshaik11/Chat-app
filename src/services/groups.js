import { addDoc, arrayRemove, arrayUnion, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/*
 * Group chats live in the same `chats` collection as 1:1 chats:
 *   chats/{groupId} = { isGroup, name, photoURL, members[], admins[], createdBy, theme, lastMessage..., unread{}, lastRead{}, typing{} }
 *   chats/{groupId}/messages/{id} = normal messages (+ senderName/senderPhoto) and small `system` notices
 *
 * Who may do what (enforced by firestore.rules too):
 *   - every member: send, rename, change the photo/theme, add people, leave
 *   - admins:       also remove people and make / dismiss admins
 */

export const MAX_GROUP_MEMBERS = 50;
export const MAX_GROUP_NAME = 40;

const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'Someone';

export function defaultGroupName(names = []) {
  const list = names.map(first).filter(Boolean);
  if (list.length <= 1) return list[0] ? `${list[0]}'s group` : 'New group';
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list[0]}, ${list[1]} & ${list.length - 2} more`;
}

// a small centred notice in the chat ("Ayan added Sam")
function notice(chatId, userId, byName, event, text = '', extra = {}) {
  return addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId: userId, senderName: byName || '', type: 'system', event, text,
    createdAt: serverTimestamp(), seenBy: {}, reactions: {}, unsent: false, ...extra,
  });
}

/** Creates a group. Returns the new group id. */
export async function createGroup({ me, name, memberIds, memberNames = [] }) {
  const myId = me?.id;
  const others = [...new Set((memberIds || []).filter((x) => x && x !== myId))];
  if (!myId || !others.length) throw new Error('Pick at least one friend.');
  if (others.length + 1 > MAX_GROUP_MEMBERS) throw new Error(`A group can have up to ${MAX_GROUP_MEMBERS} people.`);

  const title = String(name || '').trim().slice(0, MAX_GROUP_NAME) || defaultGroupName(memberNames);
  const id = `grp${doc(collection(db, 'chats')).id}`; // no "_" in the id, so it can never be mistaken for a 1:1 chat

  await setDoc(doc(db, 'chats', id), {
    isGroup: true,
    name: title,
    photoURL: '',
    members: [myId, ...others],
    admins: [myId],
    createdBy: myId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: 'Group created',
    lastSender: myId,
    lastSenderName: first(me.name),
    lastMessageAt: serverTimestamp(),
    unread: {},
  });

  await notice(id, myId, me.name, 'created', title).catch(() => {});
  return { id, name: title };
}

export async function renameGroup(chatId, me, name) {
  const title = String(name || '').trim().slice(0, MAX_GROUP_NAME);
  if (!chatId || !title) throw new Error('Type a group name.');
  await notice(chatId, me.id, me.name, 'renamed', title);
  await updateDoc(doc(db, 'chats', chatId), { name: title });
  return title;
}

export async function setGroupPhoto(chatId, me, url) {
  if (!chatId || !url) return;
  await notice(chatId, me.id, me.name, 'photo').catch(() => {});
  await updateDoc(doc(db, 'chats', chatId), { photoURL: url });
}

/** Any member can add people. `people` = [{ id, name }] */
export async function addMembers(chatId, me, currentMembers, people) {
  const fresh = (people || []).filter((p) => p?.id && !currentMembers.includes(p.id));
  if (!fresh.length) return;
  if (currentMembers.length + fresh.length > MAX_GROUP_MEMBERS) throw new Error(`A group can have up to ${MAX_GROUP_MEMBERS} people.`);
  await notice(chatId, me.id, me.name, 'added', fresh.map((p) => first(p.name)).join(', '));
  await updateDoc(doc(db, 'chats', chatId), { members: arrayUnion(...fresh.map((p) => p.id)) });
}

/** Admins only. */
export async function removeMember(chatId, me, target) {
  await notice(chatId, me.id, me.name, 'removed', first(target.name));
  await updateDoc(doc(db, 'chats', chatId), { members: arrayRemove(target.id), admins: arrayRemove(target.id) });
}

/** Admins only. */
export async function makeAdmin(chatId, me, target) {
  await notice(chatId, me.id, me.name, 'admin', first(target.name)).catch(() => {});
  await updateDoc(doc(db, 'chats', chatId), { admins: arrayUnion(target.id) });
}

/** Admins only. */
export async function dismissAdmin(chatId, target) {
  await updateDoc(doc(db, 'chats', chatId), { admins: arrayRemove(target.id) });
}

/**
 * Leave the group. If I am the only admin and others stay, the longest-standing member
 * becomes admin first, so the group is never left without one.
 */
export async function leaveGroup(chat, me) {
  const chatId = chat?.id;
  if (!chatId || !me?.id) return;
  const members = chat.members || [];
  const admins = chat.admins || [];
  const rest = members.filter((m) => m !== me.id);

  if (rest.length && admins.includes(me.id) && !admins.some((a) => a !== me.id)) {
    await updateDoc(doc(db, 'chats', chatId), { admins: arrayUnion(rest[0]) });
  }

  await notice(chatId, me.id, me.name, 'left').catch(() => {});
  await updateDoc(doc(db, 'chats', chatId), { members: arrayRemove(me.id), admins: arrayRemove(me.id) });
}
