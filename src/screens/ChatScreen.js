import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as Clipboard from 'expo-clipboard';

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import { db } from '../config/firebase';

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

const RED = '#E11D2A';
const BG = '#080808';
const CARD = '#111111';
const CARD2 = '#171717';
const BORDER = '#272727';
const TEXT = '#FFFFFF';
const MUTED = '#8F8F8F';

const QUICK_REACTIONS = ['❤️', '😂', '😅', '😢', '🔥'];

const EXTRA_REACTIONS = [
  '👍',
  '👎',
  '👏',
  '🙌',
  '😍',
  '🥰',
  '😘',
  '🤣',
  '😎',
  '🤔',
  '😮',
  '😱',
  '😡',
  '😭',
  '🥹',
  '🤗',
  '😴',
  '🤩',
  '💀',
  '🤝',
  '🙏',
  '💯',
  '✨',
  '🎉',
  '💔',
  '❤️‍🔥',
  '🫶',
  '👀',
  '🚀',
  '😈',
];

function formatSeenTime(value) {
  if (!value) return 'Seen just now';

  let date;

  try {
    if (typeof value.toDate === 'function') {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }
  } catch {
    return 'Seen just now';
  }

  if (Number.isNaN(date.getTime())) {
    return 'Seen just now';
  }

  const diff = Date.now() - date.getTime();

  if (diff < 60 * 1000) {
    return 'Seen just now';
  }

  if (diff < 60 * 60 * 1000) {
    return `Seen ${Math.floor(diff / 60000)}m ago`;
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return `Seen ${Math.floor(diff / 3600000)}h ago`;
  }

  return `Seen ${date.toLocaleDateString()}`;
}

function getCreatedTime(item) {
  if (!item?.createdAt) return 0;

  try {
    if (typeof item.createdAt.toMillis === 'function') {
      return item.createdAt.toMillis();
    }

    if (item.createdAt instanceof Date) {
      return item.createdAt.getTime();
    }

    return new Date(item.createdAt).getTime() || 0;
  } catch {
    return 0;
  }
}

function MessageRow({
  item,
  onLongPress,
  onReply,
  onReactionPress,
  inputRef,
}) {
  const meId = item._meId;
  const isMine = item.senderId === meId;

  const translateX = useRef(new Animated.Value(0)).current;

  const replyTriggered = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,

        onMoveShouldSetPanResponder: (_, gesture) => {
          return Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
        },

        onPanResponderMove: (_, gesture) => {
          if (gesture.dx > 0) {
            translateX.setValue(Math.min(gesture.dx, 85));
          }
        },

        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx >= 65 && !replyTriggered.current) {
            replyTriggered.current = true;

            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
              tension: 90,
            }).start();

            onReply(item);

            requestAnimationFrame(() => {
              inputRef?.current?.focus();
            });

            setTimeout(() => {
              replyTriggered.current = false;
            }, 250);

            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 90,
          }).start();
        },

        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [inputRef, item, onReply, translateX]
  );

  const reactions = item.reactions
    ? Object.entries(item.reactions)
    : [];

  const reactionCounts = {};

  reactions.forEach(([userId, emoji]) => {
    if (!emoji) return;

    if (!reactionCounts[emoji]) {
      reactionCounts[emoji] = 0;
    }

    reactionCounts[emoji] += 1;
  });

  const seenBy = item.seenBy || {};

  const otherSeenEntries = Object.entries(seenBy).filter(
    ([userId]) => userId !== meId
  );

  let latestSeen = null;

  if (otherSeenEntries.length > 0) {
    latestSeen = otherSeenEntries
      .map(([, value]) => value)
      .sort((a, b) => {
        const ta =
          typeof a?.toMillis === 'function'
            ? a.toMillis()
            : new Date(a || 0).getTime();

        const tb =
          typeof b?.toMillis === 'function'
            ? b.toMillis()
            : new Date(b || 0).getTime();

        return tb - ta;
      })[0];
  }

  const hasReply = !!item.replyTo;

  return (
    <View
      style={[
        styles.messageOuter,
        {
          alignItems: isMine ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View style={styles.swipeContainer}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.messageAnimated,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <Pressable
            onLongPress={() => onLongPress(item)}
            delayLongPress={350}
            style={[
              styles.messageBubble,
              isMine ? styles.myBubble : styles.otherBubble,
              item.unsent && styles.unsentBubble,
            ]}
          >
            {hasReply && (
              <View style={styles.replyQuote}>
                <View style={styles.replyAccent} />

                <View style={styles.replyQuoteContent}>
                  <Text style={styles.replyQuoteTitle}>
                    {item.replyTo.senderId === meId
                      ? 'You'
                      : item.replyTo.senderName || 'Message'}
                  </Text>

                  <Text
                    style={styles.replyQuoteText}
                    numberOfLines={2}
                  >
                    {item.replyTo.text || 'Message'}
                  </Text>
                </View>
              </View>
            )}

            <Text
              style={[
                styles.messageText,
                item.unsent && styles.unsentText,
              ]}
            >
              {item.text}
            </Text>

            {item.unsent && (
              <Text style={styles.unsentLabel}>
                Unsent message
              </Text>
            )}
          </Pressable>

          {Object.keys(reactionCounts).length > 0 && (
            <View
              style={[
                styles.reactionRow,
                isMine
                  ? styles.reactionRowMine
                  : styles.reactionRowOther,
              ]}
            >
              {Object.entries(reactionCounts).map(
                ([emoji, count]) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionChip}
                    onPress={() =>
                      onReactionPress(item, emoji)
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionEmoji}>
                      {emoji}
                    </Text>

                    {count > 1 && (
                      <Text style={styles.reactionCount}>
                        {count}
                      </Text>
                    )}
                  </TouchableOpacity>
                )
              )}
            </View>
          )}
        </Animated.View>
      </View>

      {isMine && latestSeen && (
        <Text style={styles.seenText}>
          {formatSeenTime(latestSeen)}
        </Text>
      )}
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const {
    user,
    otherUser,
    friendProfiles = {},
  } = route.params || {};

  const me = user || {};
  const other = otherUser || {};

  const meId = me.uid || me.id;
  const otherId = other.uid || other.id;

  const chatId = chatIdFor(meId, otherId);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState('');

  const [replyingTo, setReplyingTo] = useState(null);

  const [menuMessage, setMenuMessage] = useState(null);

  const [reactionMessage, setReactionMessage] = useState(null);
  const [reactionEmoji, setReactionEmoji] = useState(null);

  const [showExtraReactions, setShowExtraReactions] =
    useState(false);

  const [showForward, setShowForward] = useState(false);

  const [selectedFriends, setSelectedFriends] = useState([]);

  const [sending, setSending] = useState(false);

  const inputRef = useRef(null);

  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!meId || !otherId) {
      setLoading(false);
      return undefined;
    }

    const messagesRef = collection(
      db,
      'chats',
      chatId,
      'messages'
    );

    const q = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(80)
    );

    const unsubscribe = onSnapshot(
      q,
      async snapshot => {
        const data = snapshot.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter(message => {
            const deletedFor = message.deletedFor || [];

            return !deletedFor.includes(meId);
          });

        const mapped = data.map(message => ({
          ...message,
          _meId: meId,
        }));

        setMessages(mapped);
        setLoading(false);

        try {
          await markChatRead(chatId, meId);
          await markMessagesSeen(chatId, mapped, meId);
        } catch (error) {
          console.log(
            'Read/seen update error:',
            error?.message || error
          );
        }
      },
      error => {
        console.log(
          'Messages listener error:',
          error?.message || error
        );

        setLoading(false);
      }
    );

    return unsubscribe;
  }, [chatId, meId, otherId]);

  const closeMenu = () => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setMenuMessage(null);
    });
  };

  const openMenu = message => {
    setMenuMessage(message);

    menuAnim.setValue(0);

    requestAnimationFrame(() => {
      Animated.spring(menuAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 80,
      }).start();
    });
  };

  const handleReply = message => {
    setReplyingTo(message);
    closeMenu();

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleReaction = async emoji => {
    if (!menuMessage?.id) return;

    try {
      await reactToMessage(
        chatId,
        menuMessage.id,
        meId,
        emoji
      );

      closeMenu();
    } catch (error) {
      console.log('Reaction error:', error);

      Alert.alert(
        'Reaction failed',
        error?.message || 'Unable to react to this message.'
      );
    }
  };

  const handleReactionPress = (message, emoji) => {
    const myReaction = message.reactions?.[meId];

    if (myReaction === emoji) {
      setReactionMessage(message);
      setReactionEmoji(emoji);
    } else {
      setMenuMessage(message);
    }
  };

  const removeMyReaction = async () => {
    if (!reactionMessage?.id) return;

    try {
      await removeReaction(
        chatId,
        reactionMessage.id,
        meId
      );
    } catch (error) {
      console.log('Remove reaction error:', error);

      Alert.alert(
        'Error',
        error?.message || 'Could not remove reaction.'
      );
    } finally {
      setReactionMessage(null);
      setReactionEmoji(null);
    }
  };

  const handleUnsend = async () => {
    if (!menuMessage?.id) return;

    closeMenu();

    try {
      await unsendMessage(
        chatId,
        menuMessage.id,
        meId
      );
    } catch (error) {
      console.log('Unsend error:', error);

      Alert.alert(
        'Error',
        error?.message || 'Could not unsend message.'
      );
    }
  };

  const handleDeleteForMe = async () => {
    if (!menuMessage?.id) return;

    closeMenu();

    try {
      await deleteMessageForMe(
        chatId,
        menuMessage.id,
        meId
      );
    } catch (error) {
      console.log('Delete error:', error);

      Alert.alert(
        'Error',
        error?.message || 'Could not delete message.'
      );
    }
  };

  const handleCopy = async () => {
    if (!menuMessage?.text) return;

    try {
      await Clipboard.setStringAsync(menuMessage.text);
    } catch (error) {
      console.log('Copy error:', error);
    }

    closeMenu();
  };

  const toggleFriend = friendId => {
    setSelectedFriends(current => {
      if (current.includes(friendId)) {
        return current.filter(id => id !== friendId);
      }

      return [...current, friendId];
    });
  };

  const openForward = () => {
    if (!menuMessage) return;

    setSelectedFriends([]);
    closeMenu();

    setTimeout(() => {
      setShowForward(true);
    }, 180);
  };

  const handleForward = async () => {
    if (!menuMessage?.text) return;

    if (selectedFriends.length === 0) {
      Alert.alert(
        'Select friends',
        'Choose at least one friend.'
      );
      return;
    }

    try {
      setSending(true);

      for (const friendId of selectedFriends) {
        await sendMessage(
          meId,
          friendId,
          menuMessage.text
        );
      }

      setShowForward(false);
      setSelectedFriends([]);
      setMenuMessage(null);
    } catch (error) {
      console.log('Forward error:', error);

      Alert.alert(
        'Forward failed',
        error?.message || 'Could not forward the message.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    const cleanText = text.trim();

    if (!cleanText || sending) return;

    try {
      setSending(true);

      await sendMessage(
        meId,
        otherId,
        cleanText,
        replyingTo
          ? {
              id: replyingTo.id,
              text: replyingTo.text,
              senderId: replyingTo.senderId,
              senderName:
                replyingTo.senderId === meId
                  ? 'You'
                  : other.displayName ||
                    other.name ||
                    'Message',
            }
          : null
      );

      setText('');
      setReplyingTo(null);

      Keyboard.dismiss();
    } catch (error) {
      console.log('Send message error:', error);

      Alert.alert(
        'Send failed',
        error?.message || 'Could not send message.'
      );
    } finally {
      setSending(false);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const friendList = Object.values(friendProfiles || {})
    .filter(friend => {
      const id = friend?.uid || friend?.id;
      return id && id !== meId;
    })
    .map(friend => ({
      ...friend,
      uid: friend.uid || friend.id,
    }));

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios' ? 'padding' : undefined
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(
                other.displayName ||
                other.name ||
                '?'
              )
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerInfo}>
            <Text
              style={styles.headerName}
              numberOfLines={1}
            >
              {other.displayName ||
                other.name ||
                'User'}
            </Text>

            <Text style={styles.headerStatus}>
              {other.online
                ? 'Online'
                : 'Messages'}
            </Text>
          </View>
        </View>

        {/* MESSAGES */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={RED}
            />
          </View>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <MessageRow
                item={item}
                onLongPress={openMenu}
                onReply={handleReply}
                onReactionPress={handleReactionPress}
                inputRef={inputRef}
              />
            )}
            ListEmptyComponent={
              <View
                style={styles.emptyContainer}
              >
                <Text style={styles.emptyTitle}>
                  No messages yet
                </Text>

                <Text style={styles.emptyText}>
                  Start the conversation 👋
                </Text>
              </View>
            }
          />
        )}

        {/* REPLY PREVIEW */}
        {replyingTo && (
          <View style={styles.replyComposer}>
            <View style={styles.replyComposerAccent} />

            <View style={styles.replyComposerContent}>
              <Text style={styles.replyComposerTitle}>
                Replying to{' '}
                {replyingTo.senderId === meId
                  ? 'yourself'
                  : other.displayName ||
                    other.name ||
                    'message'}
              </Text>

              <Text
                style={styles.replyComposerText}
                numberOfLines={1}
              >
                {replyingTo.text}
              </Text>
            </View>

            <TouchableOpacity
              onPress={cancelReply}
              style={styles.replyClose}
            >
              <Text style={styles.replyCloseText}>
                ×
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* COMPOSER */}
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor="#666"
            multiline
            maxLength={4000}
            style={styles.input}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() || sending) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendText}>
                ➤
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* LONG PRESS MENU */}
        <Modal
          visible={!!menuMessage}
          transparent
          animationType="none"
          onRequestClose={closeMenu}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeMenu}
            />

            <Animated.View
              style={[
                styles.actionSheet,
                {
                  opacity: menuAnim,
                  transform: [
                    {
                      translateY: menuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [40, 0],
                      }),
                    },
                    {
                      scale: menuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.94, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* QUICK REACTIONS */}
              <View style={styles.quickReactionRow}>
                {QUICK_REACTIONS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.quickReaction}
                    onPress={() =>
                      handleReaction(emoji)
                    }
                  >
                    <Text
                      style={
                        styles.quickReactionText
                      }
                    >
                      {emoji}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[
                    styles.quickReaction,
                    styles.plusReaction,
                  ]}
                  onPress={() =>
                    setShowExtraReactions(true)
                  }
                >
                  <Text
                    style={styles.plusReactionText}
                  >
                    +
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.menuDivider} />

              <ActionButton
                icon="↩"
                label="Reply"
                onPress={() =>
                  handleReply(menuMessage)
                }
              />

              <ActionButton
                icon="➤"
                label="Forward"
                onPress={openForward}
              />

              <ActionButton
                icon="⧉"
                label="Copy"
                onPress={handleCopy}
              />

              {menuMessage?.senderId === meId &&
                !menuMessage?.unsent && (
                  <ActionButton
                    icon="↶"
                    label="Unsend"
                    danger
                    onPress={handleUnsend}
                  />
                )}

              <ActionButton
                icon="⌫"
                label="Delete for you"
                danger
                onPress={handleDeleteForMe}
              />

              <ActionButton
                icon="×"
                label="Cancel"
                onPress={closeMenu}
              />
            </Animated.View>
          </View>
        </Modal>

        {/* EXTRA REACTIONS */}
        <Modal
          visible={showExtraReactions}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setShowExtraReactions(false)
          }
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() =>
                setShowExtraReactions(false)
              }
            />

            <View style={styles.reactionSheet}>
              <View style={styles.sheetHandle} />

              <Text style={styles.sheetTitle}>
                Choose reaction
              </Text>

              <ScrollView
                contentContainerStyle={
                  styles.emojiGrid
                }
              >
                {EXTRA_REACTIONS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.bigEmojiButton}
                    onPress={async () => {
                      await handleReaction(emoji);
                      setShowExtraReactions(false);
                    }}
                  >
                    <Text style={styles.bigEmoji}>
                      {emoji}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* REMOVE REACTION */}
        <Modal
          visible={!!reactionMessage}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setReactionMessage(null);
            setReactionEmoji(null);
          }}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setReactionMessage(null);
                setReactionEmoji(null);
              }}
            />

            <View style={styles.reactionPopup}>
              <Text style={styles.reactionPopupEmoji}>
                {reactionEmoji}
              </Text>

              <Text style={styles.reactionPopupTitle}>
                Remove your reaction?
              </Text>

              <TouchableOpacity
                style={styles.redButton}
                onPress={removeMyReaction}
              >
                <Text style={styles.redButtonText}>
                  Remove
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setReactionMessage(null);
                  setReactionEmoji(null);
                }}
              >
                <Text style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* FORWARD */}
        <Modal
          visible={showForward}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setShowForward(false)
          }
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.forwardSheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.forwardHeader}>
                <Text style={styles.sheetTitle}>
                  Forward to
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setShowForward(false)
                  }
                >
                  <Text style={styles.closeText}>
                    ×
                  </Text>
                </TouchableOpacity>
              </View>

              {friendList.length === 0 ? (
                <View style={styles.noFriends}>
                  <Text style={styles.noFriendsTitle}>
                    No friends available
                  </Text>

                  <Text style={styles.noFriendsText}>
                    Your friend list is empty.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.friendScroll}
                  contentContainerStyle={
                    styles.friendList
                  }
                >
                  {friendList.map(friend => {
                    const selected =
                      selectedFriends.includes(
                        friend.uid
                      );

                    return (
                      <TouchableOpacity
                        key={friend.uid}
                        style={styles.friendRow}
                        onPress={() =>
                          toggleFriend(
                            friend.uid
                          )
                        }
                        activeOpacity={0.75}
                      >
                        <View
                          style={styles.friendAvatar}
                        >
                          <Text
                            style={
                              styles.friendAvatarText
                            }
                          >
                            {(
                              friend.displayName ||
                              friend.name ||
                              '?'
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.friendInfo
                          }
                        >
                          <Text
                            style={
                              styles.friendName
                            }
                            numberOfLines={1}
                          >
                            {friend.displayName ||
                              friend.name ||
                              'User'}
                          </Text>

                          <Text
                            style={
                              styles.friendUsername
                            }
                            numberOfLines={1}
                          >
                            {friend.username
                              ? `@${friend.username}`
                              : 'Friend'}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.checkbox,
                            selected &&
                              styles.checkboxSelected,
                          ]}
                        >
                          {selected && (
                            <Text
                              style={
                                styles.checkmark
                              }
                            >
                              ✓
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[
                  styles.forwardButton,
                  (selectedFriends.length === 0 ||
                    sending) &&
                    styles.forwardButtonDisabled,
                ]}
                disabled={
                  selectedFriends.length === 0 ||
                  sending
                }
                onPress={handleForward}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={styles.forwardButtonText}
                  >
                    Forward
                    {selectedFriends.length > 0
                      ? ` (${selectedFriends.length})`
                      : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  danger = false,
}) {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.actionIcon,
          danger && styles.actionIconDanger,
        ]}
      >
        <Text
          style={[
            styles.actionIconText,
            danger && styles.actionIconTextDanger,
          ]}
        >
          {icon}
        </Text>
      </View>

      <Text
        style={[
          styles.actionLabel,
          danger && styles.actionLabelDanger,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  container: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#0C0C0C',
  },

  backButton: {
    width: 38,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },

  backText: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '300',
    marginTop: -4,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },

  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },

  headerName: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
  },

  headerStatus: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },

  messageOuter: {
    width: '100%',
    marginVertical: 4,
  },

  swipeContainer: {
    maxWidth: '84%',
  },

  messageAnimated: {
    maxWidth: '100%',
  },

  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minWidth: 50,
  },

  myBubble: {
    backgroundColor: RED,
    borderBottomRightRadius: 5,
  },

  otherBubble: {
    backgroundColor: CARD2,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: BORDER,
  },

  unsentBubble: {
    backgroundColor: '#444',
    opacity: 0.75,
  },

  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
  },

  unsentText: {
    color: '#D0D0D0',
    fontStyle: 'italic',
  },

  unsentLabel: {
    color: '#AAA',
    fontSize: 10,
    marginTop: 3,
    fontStyle: 'italic',
  },

  replyQuote: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 9,
    marginBottom: 7,
    overflow: 'hidden',
  },

  replyAccent: {
    width: 3,
    backgroundColor: RED,
  },

  replyQuoteContent: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    flex: 1,
  },

  replyQuoteTitle: {
    color: RED,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },

  replyQuoteText: {
    color: '#A8A8A8',
    fontSize: 11,
  },

  reactionRow: {
    flexDirection: 'row',
    marginTop: -4,
  },

  reactionRowMine: {
    justifyContent: 'flex-end',
  },

  reactionRowOther: {
    justifyContent: 'flex-start',
  },

  reactionChip: {
    minHeight: 27,
    paddingHorizontal: 7,
    borderRadius: 15,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },

  reactionEmoji: {
    fontSize: 15,
  },

  reactionCount: {
    color: '#fff',
    fontSize: 11,
    marginLeft: 3,
    fontWeight: '700',
  },

  seenText: {
    color: '#777',
    fontSize: 10,
    marginTop: 2,
    marginHorizontal: 4,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 250,
  },

  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  emptyText: {
    color: '#777',
    marginTop: 5,
  },

  replyComposer: {
    minHeight: 58,
    backgroundColor: '#101010',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
  },

  replyComposerAccent: {
    width: 3,
    height: 42,
    backgroundColor: RED,
  },

  replyComposerContent: {
    flex: 1,
    paddingHorizontal: 10,
  },

  replyComposerTitle: {
    color: RED,
    fontWeight: '800',
    fontSize: 12,
  },

  replyComposerText: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 2,
  },

  replyClose: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  replyCloseText: {
    color: '#999',
    fontSize: 27,
  },

  composer: {
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#0C0C0C',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },

  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    backgroundColor: '#171717',
    color: '#fff',
    borderRadius: 23,
    paddingHorizontal: 17,
    paddingTop: 12,
    paddingBottom: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: BORDER,
  },

  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: RED,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {
    opacity: 0.45,
  },

  sendText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 2,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  actionSheet: {
    backgroundColor: '#151515',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },

  quickReactionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
  },

  quickReaction: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#333',
  },

  quickReactionText: {
    fontSize: 25,
  },

  plusReaction: {
    backgroundColor: RED,
    borderColor: RED,
  },

  plusReactionText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '400',
  },

  menuDivider: {
    height: 1,
    backgroundColor: '#292929',
    marginVertical: 8,
  },

  actionButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 12,
  },

  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  actionIconDanger: {
    backgroundColor: 'rgba(225,29,42,0.16)',
  },

  actionIconText: {
    color: '#fff',
    fontSize: 18,
  },

  actionIconTextDanger: {
    color: RED,
  },

  actionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  actionLabelDanger: {
    color: RED,
  },

  reactionSheet: {
    maxHeight: '70%',
    backgroundColor: '#151515',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 25,
  },

  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#555',
    alignSelf: 'center',
    marginBottom: 13,
  },

  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },

  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingBottom: 10,
  },

  bigEmojiButton: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#202020',
    margin: 4,
  },

  bigEmoji: {
    fontSize: 28,
  },

  reactionPopup: {
    alignSelf: 'center',
    width: '84%',
    backgroundColor: '#161616',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },

  reactionPopupEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },

  reactionPopupTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 18,
  },

  redButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  redButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  cancelButton: {
    width: '100%',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },

  cancelButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },

  forwardSheet: {
    maxHeight: '82%',
    backgroundColor: '#151515',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 15,
  },

  forwardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  closeText: {
    color: '#999',
    fontSize: 30,
    fontWeight: '300',
  },

  friendScroll: {
    maxHeight: 440,
  },

  friendList: {
    paddingVertical: 5,
  },

  friendRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },

  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  friendAvatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  friendInfo: {
    flex: 1,
    marginLeft: 11,
  },

  friendName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  friendUsername: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
  },

  checkbox: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkboxSelected: {
    backgroundColor: RED,
    borderColor: RED,
  },

  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },

  forwardButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },

  forwardButtonDisabled: {
    opacity: 0.4,
  },

  forwardButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  noFriends: {
    paddingVertical: 50,
    alignItems: 'center',
  },

  noFriendsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  noFriendsText: {
    color: '#777',
    marginTop: 5,
  },
});
