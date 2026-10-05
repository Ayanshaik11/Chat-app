import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';

import * as Clipboard from 'expo-clipboard';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';

import {
  chatIdFor,
  deleteMessageForMe,
  markChatRead,
  reactToMessage,
  removeReaction,
  sendMessage,
  unsendMessage,
} from '../services/chat';

import {
  clock,
  isOnline,
  lastSeenText,
} from '../utils/helpers';

import { gradientProps } from '../theme';

import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import T from '../components/T';

const REACTIONS = ['❤️', '😂', '😅', '😢', '🔥'];

export default function ChatScreen({ route, navigation }) {
  const { user } = route.params;

  const { me } = useAuth();
  const { chats, friendProfiles } = useAppData();
  const { colors, fonts, gradient } = useTheme();

  const chatId = chatIdFor(me.id, user.id);
  const live = friendProfiles[user.id] || user;

  const unread = chats[chatId]?.unread?.[me.id] || 0;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [menuMessage, setMenuMessage] = useState(null);

  /*
   * LIVE MESSAGES
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(80)
      ),
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      () => {}
    );

    return unsubscribe;
  }, [chatId]);

  /*
   * CLEAR UNREAD
   */
  useEffect(() => {
    if (unread > 0) {
      markChatRead(chatId, me.id).catch(() => {});
    }
  }, [unread, chatId, me.id]);

  /*
   * SEND MESSAGE
   */
  const send = async () => {
    const t = text.trim();

    if (!t) return;

    const reply = replyingTo;

    setText('');
    setReplyingTo(null);

    try {
      await sendMessage(me, user, t, reply);
    } catch (e) {
      setText(t);
      setReplyingTo(reply);

      Alert.alert(
        'Message not sent',
        e.message
      );
    }
  };

  /*
   * HIDE MESSAGES DELETED FOR ME
   */
  const visibleMessages = useMemo(() => {
    return messages.filter(
      (message) =>
        !(message.deletedFor || []).includes(me.id)
    );
  }, [messages, me.id]);

  /*
   * CLOSE LONG-PRESS MENU
   */
  const closeMenu = () => {
    setMenuMessage(null);
  };

  /*
   * REACTION
   */
  const handleReaction = async (emoji) => {
    if (!menuMessage) return;

    try {
      const currentReaction =
        menuMessage.reactions?.[me.id];

      if (currentReaction === emoji) {
        await removeReaction(
          chatId,
          menuMessage.id,
          me.id
        );
      } else {
        await reactToMessage(
          chatId,
          menuMessage.id,
          me.id,
          emoji
        );
      }
    } catch (e) {
      Alert.alert(
        'Reaction failed',
        e.message
      );
    }

    closeMenu();
  };

  /*
   * COPY
   */
  const handleCopy = async () => {
    if (!menuMessage?.text) return;

    try {
      await Clipboard.setStringAsync(
        menuMessage.text
      );
    } catch (e) {
      Alert.alert(
        'Copy failed',
        e.message
      );
    }

    closeMenu();
  };

  /*
   * REPLY
   */
  const handleReply = () => {
    if (!menuMessage) return;

    setReplyingTo(menuMessage);
    closeMenu();
  };

  /*
   * DELETE FOR ME
   */
  const handleDeleteForMe = () => {
    if (!menuMessage) return;

    const message = menuMessage;

    closeMenu();

    Alert.alert(
      'Delete for you?',
      'This message will disappear from your chat only.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMessageForMe(
              chatId,
              message.id,
              me.id
            ).catch((e) =>
              Alert.alert(
                'Delete failed',
                e.message
              )
            ),
        },
      ]
    );
  };

  /*
   * UNSEND
   */
  const handleUnsend = () => {
    if (!menuMessage) return;

    const message = menuMessage;

    closeMenu();

    Alert.alert(
      'Unsend message?',
      'This message will be removed for everyone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unsend',
          style: 'destructive',
          onPress: () =>
            unsendMessage(
              chatId,
              message.id
            ).catch((e) =>
              Alert.alert(
                'Unsend failed',
                e.message
              )
            ),
        },
      ]
    );
  };

  /*
   * FORWARD
   *
   * For now it places the text in the composer.
   * A full contact picker can be added next.
   */
  const handleForward = () => {
    if (!menuMessage) return;

    const message = menuMessage;

    closeMenu();

    setText(message.text || '');
  };

  /*
   * MESSAGE BUBBLE
   */
  const renderItem = ({ item }) => {
    const mine = item.senderId === me.id;

    const reactions = Object.values(
      item.reactions || {}
    );

    return (
      <View
        style={{
          alignSelf: mine
            ? 'flex-end'
            : 'flex-start',

          maxWidth: '80%',
          marginVertical: 4,
        }}
      >
        <Pressable
          onLongPress={() =>
            setMenuMessage(item)
          }
          delayLongPress={350}
          style={{
            backgroundColor: mine
              ? colors.bubbleMine
              : colors.bubbleOther,

            borderRadius: 18,

            borderBottomRightRadius: mine
              ? 4
              : 18,

            borderBottomLeftRadius: mine
              ? 18
              : 4,

            paddingHorizontal: 13,
            paddingVertical: 8,

            borderWidth: mine ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          {/* REPLY PREVIEW INSIDE MESSAGE */}
          {item.replyTo ? (
            <View
              style={{
                borderLeftWidth: 3,

                borderLeftColor: mine
                  ? 'rgba(255,255,255,0.8)'
                  : colors.primary,

                paddingLeft: 8,
                marginBottom: 6,
              }}
            >
              <T
                size={11}
                color={
                  mine
                    ? 'rgba(255,255,255,0.8)'
                    : 'subtext'
                }
                numberOfLines={2}
              >
                {item.replyTo.text}
              </T>
            </View>
          ) : null}

          {/* MESSAGE TEXT */}
          <T
            color={
              mine
                ? colors.bubbleMineText
                : colors.text
            }
            size={15}
          >
            {item.text}
          </T>

          {/* TIME */}
          <T
            size={10}
            color={
              mine
                ? 'rgba(255,255,255,0.75)'
                : 'subtext'
            }
            style={{
              alignSelf: 'flex-end',
              marginTop: 2,
            }}
          >
            {clock(item.createdAt)}
          </T>

          {/* REACTIONS */}
          {reactions.length > 0 ? (
            <View
              style={{
                position: 'absolute',

                bottom: -13,

                right: mine ? 8 : undefined,
                left: mine ? undefined : 8,

                flexDirection: 'row',

                backgroundColor:
                  colors.inputBg,

                borderRadius: 14,

                paddingHorizontal: 6,
                paddingVertical: 3,

                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {[...new Set(reactions)].map(
                (emoji) => (
                  <T
                    key={emoji}
                    size={14}
                    style={{
                      marginHorizontal: 1,
                    }}
                  >
                    {emoji}
                  </T>
                )
              )}
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>

      {/* HEADER */}
      <ScreenHeader
        onBack={() => navigation.goBack()}
      >
        <Pressable
          onPress={() =>
            navigation.navigate(
              'UserProfile',
              {
                userId: user.id,
              }
            )
          }
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Avatar
            uri={live.photoURL}
            name={live.name}
            size={38}
            online={isOnline(live)}
          />

          <View style={{ flex: 1 }}>
            <T
              weight="semibold"
              size={16}
              numberOfLines={1}
            >
              {live.name}
            </T>

            <T
              size={11}
              color={
                isOnline(live)
                  ? 'primary'
                  : 'subtext'
              }
            >
              {lastSeenText(live)}
            </T>
          </View>
        </Pressable>
      </ScreenHeader>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >

        {/* CHAT */}
        <View style={{ flex: 1 }}>

          <FlatList
            inverted
            data={visibleMessages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{
              padding: 12,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
          />

          {!visibleMessages.length ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,

                alignItems: 'center',
                justifyContent: 'center',

                padding: 30,
              }}
            >
              <T
                color="subtext"
                style={{
                  textAlign: 'center',
                }}
              >
                Say hello to {live.name}! 👋
              </T>
            </View>
          ) : null}

        </View>

        {/* REPLY COMPOSER */}
        {replyingTo ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',

              paddingHorizontal: 12,
              paddingVertical: 8,

              backgroundColor:
                colors.inputBg,

              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <View
              style={{
                flex: 1,

                borderLeftWidth: 3,
                borderLeftColor: colors.primary,

                paddingLeft: 8,
              }}
            >
              <T
                size={11}
                color="primary"
                weight="semibold"
              >
                Replying to message
              </T>

              <T
                size={12}
                color="subtext"
                numberOfLines={1}
              >
                {replyingTo.text}
              </T>
            </View>

            <Pressable
              onPress={() =>
                setReplyingTo(null)
              }
              hitSlop={10}
            >
              <Ionicons
                name="close-circle"
                size={24}
                color={colors.subtext}
              />
            </Pressable>
          </View>
        ) : null}

        {/* INPUT */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',

            padding: 10,
            gap: 8,

            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor={
              colors.subtext
            }
            multiline
            style={{
              flex: 1,
              maxHeight: 110,

              backgroundColor:
                colors.inputBg,

              borderRadius: 22,

              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 10,

              fontFamily: fonts.regular,
              fontSize: 15,

              color: colors.text,
            }}
          />

          <Pressable
            onPress={send}
            disabled={!text.trim()}
            style={{
              opacity: text.trim()
                ? 1
                : 0.45,
            }}
          >
            <LinearGradient
              colors={gradient}
              {...gradientProps}
              style={{
                width: 44,
                height: 44,

                borderRadius: 22,

                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="send"
                size={19}
                color="#fff"
                style={{
                  marginLeft: 2,
                }}
              />
            </LinearGradient>
          </Pressable>
        </View>

      </KeyboardAvoidingView>

      {/* LONG PRESS MENU */}
      {menuMessage ? (
        <View
          style={{
            position: 'absolute',

            left: 16,
            right: 16,
            bottom: 90,

            backgroundColor:
              colors.card,

            borderRadius: 20,

            padding: 12,

            borderWidth: 1,
            borderColor: colors.border,

            shadowOpacity: 0.25,
            shadowRadius: 12,

            elevation: 10,
          }}
        >

          {/* REACTIONS */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent:
                'space-around',

              alignItems: 'center',

              paddingVertical: 6,
              marginBottom: 6,
            }}
          >
            {REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() =>
                  handleReaction(emoji)
                }
                style={{
                  width: 42,
                  height: 42,

                  borderRadius: 21,

                  alignItems: 'center',
                  justifyContent: 'center',

                  backgroundColor:
                    colors.inputBg,
                }}
              >
                <T size={22}>
                  {emoji}
                </T>
              </Pressable>
            ))}

            {/* PLUS */}
            <Pressable
              onPress={() =>
                Alert.alert(
                  'More reactions',
                  'More reactions can be added here.'
                )
              }
              style={{
                width: 42,
                height: 42,

                borderRadius: 21,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor:
                  colors.inputBg,
              }}
            >
              <Ionicons
                name="add"
                size={23}
                color={colors.text}
              />
            </Pressable>
          </View>

          {/* REPLY */}
          <Pressable
            onPress={handleReply}
            style={{
              flexDirection: 'row',
              alignItems: 'center',

              paddingVertical: 13,
              gap: 14,
            }}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={21}
              color={colors.text}
            />

            <T size={15}>
              Reply
            </T>
          </Pressable>

          {/* UNSEND */}
          {menuMessage.senderId === me.id &&
          !menuMessage.unsent ? (
            <Pressable
              onPress={handleUnsend}
              style={{
                flexDirection: 'row',
                alignItems: 'center',

                paddingVertical: 13,
                gap: 14,
              }}
            >
              <Ionicons
                name="remove-circle-outline"
                size={21}
                color="#F43F5E"
              />

              <T
                size={15}
                color="#F43F5E"
                weight="semibold"
              >
                Unsend
              </T>
            </Pressable>
          ) : null}

          {/* DELETE FOR YOU */}
          <Pressable
            onPress={handleDeleteForMe}
            style={{
              flexDirection: 'row',
              alignItems: 'center',

              paddingVertical: 13,
              gap: 14,
            }}
          >
            <Ionicons
              name="trash-outline"
              size={21}
              color={colors.text}
            />

            <T size={15}>
              Delete for you
            </T>
          </Pressable>

          {/* COPY */}
          {!menuMessage.unsent ? (
            <Pressable
              onPress={handleCopy}
              style={{
                flexDirection: 'row',
                alignItems: 'center',

                paddingVertical: 13,
                gap: 14,
              }}
            >
              <Ionicons
                name="copy-outline"
                size={21}
                color={colors.text}
              />

              <T size={15}>
                Copy
              </T>
            </Pressable>
          ) : null}

          {/* FORWARD */}
          {!menuMessage.unsent ? (
            <Pressable
              onPress={handleForward}
              style={{
                flexDirection: 'row',
                alignItems: 'center',

                paddingVertical: 13,
                gap: 14,
              }}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={21}
                color={colors.text}
              />

              <T size={15}>
                Forward
              </T>
            </Pressable>
          ) : null}

          {/* CANCEL */}
          <Pressable
            onPress={closeMenu}
            style={{
              alignItems: 'center',

              paddingTop: 8,
              paddingBottom: 2,
            }}
          >
            <T
              size={13}
              color="subtext"
            >
              Cancel
            </T>
          </Pressable>

        </View>
      ) : null}

    </Screen>
  );
}