import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import * as Clipboard from 'expo-clipboard';

import { Ionicons } from '@expo/vector-icons';

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
  markMessagesSeen,
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

import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import T from '../components/T';

const RED = '#E11D2A';

const QUICK_REACTIONS = [
  '❤️',
  '😂',
  '😅',
  '😢',
  '🔥',
];

const EXTRA_REACTIONS = [
  '👍',
  '👎',
  '😍',
  '😘',
  '🥰',
  '🤣',
  '😊',
  '😁',
  '😎',
  '🤩',
  '😮',
  '😡',
  '😭',
  '🤔',
  '🙄',
  '👏',
  '🙏',
  '💯',
  '✨',
  '🎉',
  '💔',
  '❤️‍🔥',
  '🥹',
  '😴',
  '🤝',
  '👀',
  '💀',
  '🚀',
  '⭐',
  '🫶',
];

function formatSeenTime(timestamp) {
  if (!timestamp) return 'Seen just now';

  const date = timestamp?.toDate
    ? timestamp.toDate()
    : new Date(timestamp);

  const diff = Date.now() - date.getTime();

  if (diff < 60 * 1000) {
    return 'Seen just now';
  }

  const minutes = Math.floor(diff / 60000);

  if (minutes < 60) {
    return `Seen ${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `Seen ${hours}h ago`;
  }

  return 'Seen';
}

// ---------------------------------------------------------
// MESSAGE ROW
// ---------------------------------------------------------

function MessageRow({
  item,
  mine,
  colors,
  onLongPress,
  onReply,
  onReactionPress,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,

        onMoveShouldSetPanResponder: (_, gesture) => {
          return (
            Math.abs(gesture.dx) > 8 &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy)
          );
        },

        onPanResponderGrant: () => {
          triggered.current = false;
        },

        onPanResponderMove: (_, gesture) => {
          // Instagram-style right swipe to reply.
          const distance = Math.max(
            0,
            Math.min(85, gesture.dx)
          );

          translateX.setValue(distance);

          if (distance >= 65 && !triggered.current) {
            triggered.current = true;

            onReply(item);

            setTimeout(() => {
              Keyboard.dismiss();
            }, 50);
          }
        },

        onPanResponderRelease: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
          }).start();
        },

        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [item, onReply, translateX]
  );

  const reactionEntries = Object.entries(
    item.reactions || {}
  );

  const myReaction = item.reactions?.[item._meId];

  const seenByOther = mine
    ? Object.keys(item.seenBy || {}).some(
        (id) => id !== item._meId
      )
    : false;

  const bubbleColor = item.unsent
    ? '#555'
    : mine
      ? colors.bubbleMine
      : colors.bubbleOther;

  const textColor = item.unsent
    ? '#C8C8C8'
    : mine
      ? colors.bubbleMineText
      : colors.text;

  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '84%',
        marginVertical: 3,
      }}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={{
          transform: [{ translateX }],
        }}
      >
        <Pressable
          onLongPress={() => onLongPress(item)}
          delayLongPress={350}
        >
          <View
            style={{
              backgroundColor: bubbleColor,
              borderRadius: 18,

              borderBottomRightRadius: mine ? 4 : 18,
              borderBottomLeftRadius: mine ? 18 : 4,

              paddingHorizontal: 13,
              paddingVertical: 8,

              borderWidth: mine || item.unsent ? 0 : 1,
              borderColor: colors.border,

              opacity: item.unsent ? 0.75 : 1,
            }}
          >
            {/* -----------------------------------------
                REPLY PREVIEW
            ----------------------------------------- */}

            {item.replyTo ? (
              <View
                style={{
                  backgroundColor: item.unsent
                    ? '#444'
                    : 'rgba(120, 0, 0, 0.28)',

                  borderLeftWidth: 3,
                  borderLeftColor: RED,

                  borderRadius: 8,

                  paddingHorizontal: 9,
                  paddingVertical: 6,

                  marginBottom: 7,
                }}
              >
                <T
                  size={10}
                  weight="semibold"
                  color={item.unsent ? '#AAA' : RED}
                >
                  Replying to message
                </T>

                <T
                  size={12}
                  color={
                    item.unsent
                      ? '#999'
                      : mine
                        ? 'rgba(255,255,255,0.72)'
                        : colors.subtext
                  }
                  numberOfLines={2}
                  style={{ marginTop: 2 }}
                >
                  {item.replyTo.text || 'Message'}
                </T>
              </View>
            ) : null}

            {/* -----------------------------------------
                MESSAGE
            ----------------------------------------- */}

            <T
              color={textColor}
              size={15}
              style={
                item.unsent
                  ? {
                      fontStyle: 'italic',
                    }
                  : undefined
              }
            >
              {item.text}
            </T>

            {/* -----------------------------------------
                TIME
            ----------------------------------------- */}

            <T
              size={10}
              color={
                item.unsent
                  ? '#999'
                  : mine
                    ? 'rgba(255,255,255,0.75)'
                    : 'subtext'
              }
              style={{
                alignSelf: 'flex-end',
                marginTop: 3,
              }}
            >
              {clock(item.createdAt)}
            </T>
          </View>

          {/* -------------------------------------------
              REACTIONS
          ------------------------------------------- */}

          {reactionEntries.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignSelf: mine
                  ? 'flex-end'
                  : 'flex-start',
                marginTop: -4,
                marginHorizontal: 5,
              }}
            >
              {[
                ...new Set(
                  reactionEntries.map(
                    ([, emoji]) => emoji
                  )
                ),
              ].map((emoji) => {
                const count = reactionEntries.filter(
                  ([, value]) => value === emoji
                ).length;

                return (
                  <Pressable
                    key={emoji}
                    onPress={() =>
                      onReactionPress(item, emoji)
                    }
                    style={{
                      backgroundColor:
                        colors.inputBg,
                      borderRadius: 12,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      marginRight: 3,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <T size={12}>
                      {emoji}
                      {count > 1 ? ` ${count}` : ''}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* -------------------------------------------
              SEEN
          ------------------------------------------- */}

          {mine && seenByOther && !item.unsent ? (
            <T
              size={9}
              color="subtext"
              style={{
                alignSelf: 'flex-end',
                marginTop: 2,
                marginRight: 3,
              }}
            >
              {formatSeenTime(
                Object.values(item.seenBy || {}).find(
                  (v, index, arr) =>
                    index === arr.length - 1
                )
              )}
            </T>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------
// MAIN SCREEN
// ---------------------------------------------------------

export default function ChatScreen({
  route,
  navigation,
}) {
  const { user } = route.params;

  const { me } = useAuth();

  const {
    chats,
    friendProfiles,
  } = useAppData();

  const {
    colors,
    fonts,
  } = useTheme();

  const chatId = chatIdFor(me.id, user.id);

  const live = friendProfiles[user.id] || user;

  const unread =
    chats[chatId]?.unread?.[me.id] || 0;

  const [messages, setMessages] = useState([]);

  const [text, setText] = useState('');

  const [replyingTo, setReplyingTo] =
    useState(null);

  const [menuMessage, setMenuMessage] =
    useState(null);

  const [reactionMessage, setReactionMessage] =
    useState(null);

  const [emojiPickerVisible, setEmojiPickerVisible] =
    useState(false);

  const [forwardVisible, setForwardVisible] =
    useState(false);

  const [selectedFriends, setSelectedFriends] =
    useState([]);

  const [forwarding, setForwarding] =
    useState(false);

  // -------------------------------------------------------
  // MESSAGES
  // -------------------------------------------------------

  useEffect(() => {
    return onSnapshot(
      query(
        collection(
          db,
          'chats',
          chatId,
          'messages'
        ),
        orderBy('createdAt', 'desc'),
        limit(80)
      ),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          _meId: me.id,
        }));

        setMessages(data);
      },
      () => {}
    );
  }, [chatId, me.id]);

  // -------------------------------------------------------
  // READ CHAT
  // -------------------------------------------------------

  useEffect(() => {
    if (unread > 0) {
      markChatRead(chatId, me.id).catch(() => {});
    }
  }, [unread, chatId, me.id]);

  // -------------------------------------------------------
  // MARK INCOMING MESSAGES SEEN
  // -------------------------------------------------------

  useEffect(() => {
    if (!messages.length) return;

    markMessagesSeen(
      chatId,
      messages,
      me.id
    ).catch(() => {});
  }, [messages.length, chatId, me.id]);

  // -------------------------------------------------------
  // SEND
  // -------------------------------------------------------

  const send = async () => {
    const t = text.trim();

    if (!t) return;

    const reply = replyingTo;

    setText('');
    setReplyingTo(null);

    try {
      await sendMessage(
        me,
        user,
        t,
        reply
      );
    } catch (e) {
      setText(t);
      setReplyingTo(reply);

      Alert.alert(
        'Message not sent',
        e.message
      );
    }
  };

  // -------------------------------------------------------
  // LONG PRESS
  // -------------------------------------------------------

  const openMenu = (message) => {
    setMenuMessage(message);
  };

  const closeMenu = () => {
    setMenuMessage(null);
  };

  // -------------------------------------------------------
  // REPLY
  // -------------------------------------------------------

  const startReply = (message) => {
    setReplyingTo(message);
    closeMenu();

    setTimeout(() => {
      // TextInput receives focus through autoFocus
      // state change below.
    }, 50);
  };

  // -------------------------------------------------------
  // COPY
  // -------------------------------------------------------

  const handleCopy = async () => {
    if (!menuMessage || menuMessage.unsent) {
      return;
    }

    await Clipboard.setStringAsync(
      menuMessage.text || ''
    );

    closeMenu();
  };

  // -------------------------------------------------------
  // UNSEND
  // -------------------------------------------------------

  const handleUnsend = () => {
    if (!menuMessage) return;

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
          onPress: async () => {
            try {
              await unsendMessage(
                chatId,
                menuMessage.id
              );
            } catch (e) {
              Alert.alert(
                'Unsend failed',
                e.message
              );
            }

            closeMenu();
          },
        },
      ]
    );
  };

  // -------------------------------------------------------
  // DELETE FOR ME
  // -------------------------------------------------------

  const handleDeleteForMe = () => {
    if (!menuMessage) return;

    Alert.alert(
      'Delete for you?',
      'This message will disappear from your chat.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessageForMe(
                chatId,
                menuMessage.id,
                me.id
              );
            } catch (e) {
              Alert.alert(
                'Delete failed',
                e.message
              );
            }

            closeMenu();
          },
        },
      ]
    );
  };

  // -------------------------------------------------------
  // REACTION
  // -------------------------------------------------------

  const chooseReaction = async (
    message,
    emoji
  ) => {
    try {
      await reactToMessage(
        chatId,
        message.id,
        me.id,
        emoji
      );
    } catch (e) {
      Alert.alert(
        'Reaction failed',
        e.message
      );
    }
  };

  const handleReactionPress = (
    message,
    emoji
  ) => {
    setReactionMessage({
      ...message,
      selectedEmoji: emoji,
    });
  };

  const removeMyReaction = async () => {
    if (!reactionMessage) return;

    try {
      await removeReaction(
        chatId,
        reactionMessage.id,
        me.id
      );
    } catch (e) {
      Alert.alert(
        'Could not remove reaction',
        e.message
      );
    }

    setReactionMessage(null);
  };

  // -------------------------------------------------------
  // FORWARD
  // -------------------------------------------------------

  const openForward = () => {
    if (!menuMessage || menuMessage.unsent) {
      return;
    }

    setSelectedFriends([]);
    setForwardVisible(true);
    closeMenu();
  };

  const toggleFriend = (friendId) => {
    setSelectedFriends((current) =>
      current.includes(friendId)
        ? current.filter(
            (id) => id !== friendId
          )
        : [...current, friendId]
    );
  };

  const forwardMessage = async () => {
    if (!menuMessage) return;

    if (!selectedFriends.length) {
      Alert.alert(
        'Select friends',
        'Choose at least one friend.'
      );
      return;
    }

    setForwarding(true);

    try {
      for (const friendId of selectedFriends) {
        const friend = friendProfiles[friendId];

        if (!friend) continue;

        await sendMessage(
          me,
          friend,
          menuMessage.text || ''
        );
      }

      setForwardVisible(false);
      setSelectedFriends([]);
      setMenuMessage(null);
    } catch (e) {
      Alert.alert(
        'Forward failed',
        e.message
      );
    } finally {
      setForwarding(false);
    }
  };

  // -------------------------------------------------------
  // FRIEND LIST
  // -------------------------------------------------------

  const friends = Object.values(
    friendProfiles || {}
  ).filter(
    (friend) => friend?.id && friend.id !== me.id
  );

  // -------------------------------------------------------
  // FILTER DELETED
  // -------------------------------------------------------

  const visibleMessages = messages.filter(
    (message) =>
      !message.deletedFor?.includes(me.id)
  );

  // -------------------------------------------------------
  // RENDER MESSAGE
  // -------------------------------------------------------

  const renderItem = ({ item, index }) => {
    const mine =
      item.senderId === me.id;

    return (
      <MessageRow
        item={item}
        mine={mine}
        colors={colors}
        onLongPress={openMenu}
        onReply={startReply}
        onReactionPress={
          handleReactionPress
        }
      />
    );
  };

  // -------------------------------------------------------
  // SCREEN
  // -------------------------------------------------------

  return (
    <Screen edges={['top', 'bottom']}>

      {/* =================================================
          HEADER
      ================================================= */}

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

      {/* =================================================
          CHAT
      ================================================= */}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
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

        {/* =================================================
            REPLY PREVIEW
        ================================================= */}

        {replyingTo ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',

              borderTopWidth: 1,
              borderTopColor: colors.border,

              paddingHorizontal: 12,
              paddingVertical: 8,

              backgroundColor: colors.inputBg,
            }}
          >
            <View
              style={{
                flex: 1,
                borderLeftWidth: 3,
                borderLeftColor: RED,
                paddingLeft: 9,
              }}
            >
              <T
                size={11}
                weight="semibold"
                color="primary"
              >
                Replying to message
              </T>

              <T
                size={12}
                color="subtext"
                numberOfLines={1}
                style={{ marginTop: 2 }}
              >
                {replyingTo.text}
              </T>
            </View>

            <Pressable
              onPress={() =>
                setReplyingTo(null)
              }
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="close"
                size={21}
                color={colors.subtext}
              />
            </Pressable>
          </View>
        ) : null}

        {/* =================================================
            COMPOSER
        ================================================= */}

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
              width: 44,
              height: 44,
              borderRadius: 22,

              backgroundColor: RED,

              alignItems: 'center',
              justifyContent: 'center',

              opacity: text.trim()
                ? 1
                : 0.4,
            }}
          >
            <Ionicons
              name="send"
              size={19}
              color="#fff"
              style={{ marginLeft: 2 }}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* =================================================
          LONG PRESS MENU
      ================================================= */}

      <Modal
        visible={!!menuMessage}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={closeMenu}
        >
          <Pressable
            style={[
              styles.actionSheet,
              {
                backgroundColor:
                  colors.inputBg,
              },
            ]}
            onPress={(e) =>
              e.stopPropagation()
            }
          >

            {/* Reactions */}

            <View
              style={styles.quickReactionRow}
            >
              {QUICK_REACTIONS.map(
                (emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      chooseReaction(
                        menuMessage,
                        emoji
                      );
                      closeMenu();
                    }}
                    style={
                      styles.quickReaction
                    }
                  >
                    <T size={25}>
                      {emoji}
                    </T>
                  </Pressable>
                )
              )}

              <Pressable
                onPress={() => {
                  setEmojiPickerVisible(
                    true
                  );
                }}
                style={[
                  styles.plusReaction,
                  {
                    backgroundColor:
                      RED,
                  },
                ]}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color="#fff"
                />
              </Pressable>
            </View>

            {/* Reply */}

            <ActionButton
              icon="arrow-undo-outline"
              text="Reply"
              colors={colors}
              onPress={() =>
                startReply(menuMessage)
              }
            />

            {/* Forward */}

            {!menuMessage?.unsent ? (
              <ActionButton
                icon="arrow-redo-outline"
                text="Forward"
                colors={colors}
                onPress={openForward}
              />
            ) : null}

            {/* Copy */}

            {!menuMessage?.unsent ? (
              <ActionButton
                icon="copy-outline"
                text="Copy"
                colors={colors}
                onPress={handleCopy}
              />
            ) : null}

            {/* Unsend */}

            {menuMessage?.senderId ===
              me.id &&
            !menuMessage?.unsent ? (
              <ActionButton
                icon="remove-circle-outline"
                text="Unsend"
                colors={colors}
                danger
                onPress={handleUnsend}
              />
            ) : null}

            {/* Delete */}

            <ActionButton
              icon="trash-outline"
              text="Delete for you"
              colors={colors}
              danger
              onPress={handleDeleteForMe}
            />

            {/* Cancel */}

            <Pressable
              onPress={closeMenu}
              style={[
                styles.cancelButton,
                {
                  backgroundColor:
                    colors.background,
                },
              ]}
            >
              <T
                weight="semibold"
                color="subtext"
              >
                Cancel
              </T>
            </Pressable>

          </Pressable>
        </Pressable>
      </Modal>

      {/* =================================================
          EXTRA EMOJI PICKER
      ================================================= */}

      <Modal
        visible={emojiPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setEmojiPickerVisible(false)
        }
      >
        <View style={styles.modalBackdrop}>

          <View
            style={[
              styles.emojiSheet,
              {
                backgroundColor:
                  colors.inputBg,
              },
            ]}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                marginBottom: 12,
              }}
            >
              <T
                weight="semibold"
                size={17}
              >
                Choose reaction
              </T>

              <Pressable
                onPress={() =>
                  setEmojiPickerVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <ScrollView>
              <View
                style={
                  styles.emojiGrid
                }
              >
                {EXTRA_REACTIONS.map(
                  (emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => {
                        chooseReaction(
                          menuMessage,
                          emoji
                        );

                        setEmojiPickerVisible(
                          false
                        );

                        closeMenu();
                      }}
                      style={
                        styles.emojiItem
                      }
                    >
                      <T size={29}>
                        {emoji}
                      </T>
                    </Pressable>
                  )
                )}
              </View>
            </ScrollView>
          </View>

        </View>
      </Modal>

      {/* =================================================
          REACTION REMOVE POPUP
      ================================================= */}

      <Modal
        visible={!!reactionMessage}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setReactionMessage(null)
        }
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() =>
            setReactionMessage(null)
          }
        >
          <Pressable
            style={[
              styles.reactionPopup,
              {
                backgroundColor:
                  colors.inputBg,
              },
            ]}
            onPress={(e) =>
              e.stopPropagation()
            }
          >
            <T
              size={16}
              weight="semibold"
            >
              Your reaction
            </T>

            <T
              size={38}
              style={{
                textAlign: 'center',
                marginVertical: 12,
              }}
            >
              {reactionMessage?.selectedEmoji}
            </T>

            <Pressable
              onPress={removeMyReaction}
              style={[
                styles.redButton,
                {
                  backgroundColor: RED,
                },
              ]}
            >
              <Ionicons
                name="remove-circle-outline"
                size={19}
                color="#fff"
              />

              <T
                color="#fff"
                weight="semibold"
              >
                Remove reaction
              </T>
            </Pressable>

            <Pressable
              onPress={() =>
                setReactionMessage(null)
              }
              style={{
                alignItems: 'center',
                paddingVertical: 12,
              }}
            >
              <T color="subtext">
                Cancel
              </T>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* =================================================
          FORWARD FRIEND SELECTOR
      ================================================= */}

      <Modal
        visible={forwardVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setForwardVisible(false)
        }
      >
        <View style={styles.modalBackdrop}>

          <View
            style={[
              styles.forwardSheet,
              {
                backgroundColor:
                  colors.inputBg,
              },
            ]}
          >

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                marginBottom: 14,
              }}
            >
              <View>
                <T
                  size={18}
                  weight="semibold"
                >
                  Forward message
                </T>

                <T
                  size={11}
                  color="subtext"
                  style={{
                    marginTop: 2,
                  }}
                >
                  Select multiple friends
                </T>
              </View>

              <Pressable
                onPress={() =>
                  setForwardVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <ScrollView
              style={{
                maxHeight: 430,
              }}
            >
              {friends.length ? (
                friends.map((friend) => {
                  const selected =
                    selectedFriends.includes(
                      friend.id
                    );

                  return (
                    <Pressable
                      key={friend.id}
                      onPress={() =>
                        toggleFriend(
                          friend.id
                        )
                      }
                      style={{
                        flexDirection:
                          'row',
                        alignItems:
                          'center',

                        paddingVertical: 10,

                        borderBottomWidth:
                          1,
                        borderBottomColor:
                          colors.border,
                      }}
                    >
                      <Avatar
                        uri={
                          friend.photoURL
                        }
                        name={
                          friend.name
                        }
                        size={42}
                        online={isOnline(
                          friend
                        )}
                      />

                      <View
                        style={{
                          flex: 1,
                          marginLeft: 11,
                        }}
                      >
                        <T
                          weight="semibold"
                        >
                          {friend.name}
                        </T>

                        <T
                          size={11}
                          color="subtext"
                        >
                          {isOnline(
                            friend
                          )
                            ? 'Online'
                            : 'Offline'}
                        </T>
                      </View>

                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor:
                              selected
                                ? RED
                                : colors.border,

                            backgroundColor:
                              selected
                                ? RED
                                : 'transparent',
                          },
                        ]}
                      >
                        {selected ? (
                          <Ionicons
                            name="checkmark"
                            size={17}
                            color="#fff"
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View
                  style={{
                    padding: 30,
                    alignItems:
                      'center',
                  }}
                >
                  <T color="subtext">
                    No friends available.
                  </T>
                </View>
              )}
            </ScrollView>

            <Pressable
              disabled={
                forwarding ||
                !selectedFriends.length
              }
              onPress={forwardMessage}
              style={[
                styles.forwardButton,
                {
                  backgroundColor: RED,
                  opacity:
                    forwarding ||
                    !selectedFriends.length
                      ? 0.45
                      : 1,
                },
              ]}
            >
              <Ionicons
                name="arrow-redo"
                size={19}
                color="#fff"
              />

              <T
                color="#fff"
                weight="semibold"
              >
                {forwarding
                  ? 'Forwarding...'
                  : `Forward${
                      selectedFriends.length
                        ? ` to ${selectedFriends.length}`
                        : ''
                    }`}
              </T>
            </Pressable>

          </View>
        </View>
      </Modal>

    </Screen>
  );
}

// ---------------------------------------------------------
// ACTION BUTTON
// ---------------------------------------------------------

function ActionButton({
  icon,
  text,
  colors,
  onPress,
  danger = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        gap: 13,
      }}
    >
      <Ionicons
        name={icon}
        size={21}
        color={danger ? '#F43F5E' : colors.text}
      />

      <T
        color={danger ? '#F43F5E' : colors.text}
        size={15}
      >
        {text}
      </T>
    </Pressable>
  );
}

// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },

  actionSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 25,
  },

  quickReactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 5,
  },

  quickReaction: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  plusReaction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  cancelButton: {
    marginTop: 8,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13,
  },

  emojiSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
  },

  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  emojiItem: {
    width: '16.66%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reactionPopup: {
    position: 'absolute',
    left: 25,
    right: 25,
    top: '35%',
    borderRadius: 20,
    padding: 20,
  },

  redButton: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  forwardSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  forwardButton: {
    height: 48,
    borderRadius: 13,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});