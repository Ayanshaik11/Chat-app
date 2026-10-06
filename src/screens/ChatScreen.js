import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
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
import * as Haptics from 'expo-haptics';

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
const BORDER = '#292929';

const TEXT = '#FFFFFF';
const MUTED = '#8F8F8F';

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

function toMillis(value) {
  try {
    if (!value) return 0;

    if (typeof value.toMillis === 'function') {
      return value.toMillis();
    }

    if (typeof value.toDate === 'function') {
      return value.toDate().getTime();
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    const parsed = new Date(value).getTime();

    return Number.isNaN(parsed)
      ? 0
      : parsed;
  } catch {
    return 0;
  }
}

function formatSeenTime(value) {
  const millis = toMillis(value);

  if (!millis) {
    return 'Seen just now';
  }

  const diff = Math.max(
    0,
    Date.now() - millis
  );

  if (diff < 60 * 1000) {
    return 'Seen just now';
  }

  if (diff < 60 * 60 * 1000) {
    return `Seen ${Math.floor(
      diff / 60000
    )}m ago`;
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return `Seen ${Math.floor(
      diff / 3600000
    )}h ago`;
  }

  return `Seen ${new Date(
    millis
  ).toLocaleDateString()}`;
}

/* =========================================================
   MESSAGE ROW
========================================================= */

function MessageRow({
  item,
  onLongPress,
  onReply,
  onReactionPress,
  inputRef,
}) {
  const meId = item._meId;
  const otherId = item._otherId;

  const isMine = item.senderId === meId;

  const translateX = useRef(
    new Animated.Value(0)
  ).current;

  const pressScale = useRef(
    new Animated.Value(1)
  ).current;

  const longPressTriggered = useRef(false);

  const handlePressIn = () => {
    Animated.timing(pressScale, {
      toValue: 0.97,
      duration: 70,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 30,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleLongPress = async () => {
    if (longPressTriggered.current) {
      return;
    }

    longPressTriggered.current = true;

    try {
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light
      );
    } catch {}

    onLongPress(item);

    setTimeout(() => {
      longPressTriggered.current = false;
    }, 250);
  };

  /*
   * RIGHT -> LEFT = negative dx
   *
   * The old code used positive dx, which was
   * LEFT -> RIGHT.
   */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,

        onMoveShouldSetPanResponder: (
          _,
          gesture
        ) => {
          return (
            gesture.dx < -8 &&
            Math.abs(gesture.dx) >
              Math.abs(gesture.dy) &&
            Math.abs(gesture.dx) > 8
          );
        },

        onPanResponderMove: (
          _,
          gesture
        ) => {
          if (gesture.dx < 0) {
            translateX.setValue(
              Math.max(gesture.dx, -82)
            );
          }
        },

        onPanResponderRelease: (
          _,
          gesture
        ) => {
          if (gesture.dx <= -55) {
            Animated.timing(translateX, {
              toValue: 0,
              duration: 110,
              useNativeDriver: true,
            }).start();

            onReply(item);

            requestAnimationFrame(() => {
              inputRef?.current?.focus();
            });

            return;
          }

          Animated.timing(translateX, {
            toValue: 0,
            duration: 90,
            useNativeDriver: true,
          }).start();
        },

        onPanResponderTerminate: () => {
          Animated.timing(translateX, {
            toValue: 0,
            duration: 90,
            useNativeDriver: true,
          }).start();
        },
      }),
    [
      inputRef,
      item,
      onReply,
      translateX,
    ]
  );

  const reactions = item.reactions
    ? Object.entries(item.reactions)
    : [];

  const reactionCounts = {};

  reactions.forEach(
    ([, emoji]) => {
      if (!emoji) return;

      if (!reactionCounts[emoji]) {
        reactionCounts[emoji] = 0;
      }

      reactionCounts[emoji] += 1;
    }
  );

  /*
   * Seen mechanism:
   *
   * Only YOUR messages can show "Seen".
   * We specifically check whether the OTHER
   * participant has seen this message.
   */
  const otherSeenAt =
    isMine &&
    item.seenBy?.[otherId]
      ? item.seenBy[otherId]
      : null;

  const hasReply =
    !!item.replyTo &&
    !item.unsent;

  const replySenderName =
    item.replyTo?.senderId === meId
      ? 'You'
      : item.replyTo?.senderName ||
        'Message';

  return (
    <View
      style={[
        styles.messageOuter,
        {
          alignItems: isMine
            ? 'flex-end'
            : 'flex-start',
        },
      ]}
    >
      <View style={styles.swipeContainer}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.messageAnimated,
            {
              transform: [
                {
                  translateX,
                },
                {
                  scale: pressScale,
                },
              ],
            },
          ]}
        >
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={handleLongPress}
            delayLongPress={300}
            style={[
              styles.messageBubble,
              isMine
                ? styles.myBubble
                : styles.otherBubble,
              item.unsent &&
                styles.unsentBubble,
            ]}
          >
            {/* =================================================
                REPLIED MESSAGE
            ================================================= */}

            {hasReply && (
              <View style={styles.replyQuote}>
                <View
                  style={styles.replyAccent}
                />

                <View
                  style={
                    styles.replyQuoteContent
                  }
                >
                  <Text
                    style={
                      styles.replyQuoteTitle
                    }
                    numberOfLines={1}
                  >
                    {replySenderName}
                  </Text>

                  <Text
                    style={
                      styles.replyQuoteText
                    }
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {String(
                      item.replyTo?.text ||
                        'Message'
                    )}
                  </Text>
                </View>
              </View>
            )}

            {/* =================================================
                CURRENT MESSAGE
            ================================================= */}

            <Text
              style={[
                styles.messageText,
                item.unsent &&
                  styles.unsentText,
              ]}
            >
              {String(item.text || '')}
            </Text>

            {item.unsent && (
              <Text style={styles.unsentLabel}>
                Unsent message
              </Text>
            )}
          </Pressable>

          {/* =================================================
              REACTIONS
          ================================================= */}

          {Object.keys(reactionCounts).length >
            0 && (
            <View
              style={[
                styles.reactionRow,
                isMine
                  ? styles.reactionRowMine
                  : styles.reactionRowOther,
              ]}
            >
              {Object.entries(
                reactionCounts
              ).map(([emoji, count]) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionChip}
                  onPress={() =>
                    onReactionPress(
                      item,
                      emoji
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={
                      styles.reactionEmoji
                    }
                  >
                    {emoji}
                  </Text>

                  {count > 1 && (
                    <Text
                      style={
                        styles.reactionCount
                      }
                    >
                      {count}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      </View>

      {/* =====================================================
          SEEN
      ===================================================== */}

      {otherSeenAt && (
        <Text style={styles.seenText}>
          {formatSeenTime(otherSeenAt)}
        </Text>
      )}
    </View>
  );
}

/* =========================================================
   MAIN CHAT SCREEN
========================================================= */

export default function ChatScreen({
  route,
  navigation,
}) {
  const {
    user,
    otherUser,
    friendProfiles = {},
  } = route.params || {};

  const me = user || {};
  const other = otherUser || {};

  /*
   * IMPORTANT
   *
   * King X uses the GOOGLE PROVIDER ID as its
   * application-level ID.
   *
   * Therefore:
   *     id -> preferred
   *     uid -> fallback only
   *
   * Firebase Auth UID must NOT replace the
   * existing Google-ID based chat IDs.
   */
  const meId =
    me.id || me.uid || null;

  const otherId =
    other.id || other.uid || null;

  const chatId = chatIdFor(
    meId,
    otherId
  );

  /*
   * Profile fallback:
   *
   * Sometimes navigation has only a partial
   * user object. friendProfiles may contain the
   * complete Firestore profile.
   */
  const otherProfile =
    friendProfiles?.[otherId] ||
    other;

  const otherPhoto =
    otherProfile?.photoURL ||
    otherProfile?.photoUrl ||
    otherProfile?.profilePic ||
    otherProfile?.avatar ||
    '';

  const otherName =
    otherProfile?.displayName ||
    otherProfile?.name ||
    'User';

  const [messages, setMessages] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [text, setText] =
    useState('');

  const [replyingTo, setReplyingTo] =
    useState(null);

  const [menuMessage, setMenuMessage] =
    useState(null);

  const [
    reactionMessage,
    setReactionMessage,
  ] = useState(null);

  const [
    reactionEmoji,
    setReactionEmoji,
  ] = useState(null);

  const [
    showExtraReactions,
    setShowExtraReactions,
  ] = useState(false);

  const [
    showForward,
    setShowForward,
  ] = useState(false);

  const [
    selectedFriends,
    setSelectedFriends,
  ] = useState([]);

  const [sending, setSending] =
    useState(false);

  const inputRef = useRef(null);

  const menuAnim = useRef(
    new Animated.Value(0)
  ).current;

  /* =======================================================
     FIRESTORE LISTENER
  ======================================================= */

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
            const deletedFor =
              message.deletedFor || [];

            return !deletedFor.includes(
              meId
            );
          });

        /*
         * Add local identity fields used
         * only by the UI.
         */
        const mapped = data.map(
          message => ({
            ...message,
            _meId: meId,
            _otherId: otherId,
          })
        );

        setMessages(mapped);
        setLoading(false);

        try {
          await markChatRead(
            chatId,
            meId
          );

          await markMessagesSeen(
            chatId,
            mapped,
            meId
          );
        } catch (error) {
          console.log(
            'Read/seen error:',
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
  }, [
    chatId,
    meId,
    otherId,
  ]);

  /* =======================================================
     MENU ANIMATION
  ======================================================= */

  const closeMenu = () => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setMenuMessage(null);
    });
  };

  const openMenu = message => {
    setMenuMessage(message);

    menuAnim.setValue(0);

    requestAnimationFrame(() => {
      Animated.timing(menuAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  /* =======================================================
     REPLY
  ======================================================= */

  const handleReply = message => {
    if (!message || message.unsent) {
      return;
    }

    setReplyingTo(message);

    closeMenu();

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  /* =======================================================
     REACTION
  ======================================================= */

  const handleReaction = async emoji => {
    if (!menuMessage?.id) {
      return;
    }

    try {
      await reactToMessage(
        chatId,
        menuMessage.id,
        meId,
        emoji
      );

      closeMenu();
    } catch (error) {
      console.log(
        'Reaction error:',
        error
      );

      Alert.alert(
        'Reaction failed',
        error?.message ||
          'Unable to react to this message.'
      );
    }
  };

  const handleReactionPress = (
    message,
    emoji
  ) => {
    const myReaction =
      message.reactions?.[meId];

    if (myReaction === emoji) {
      setReactionMessage(message);
      setReactionEmoji(emoji);
    } else {
      setMenuMessage(message);
    }
  };

  const removeMyReaction = async () => {
    if (!reactionMessage?.id) {
      return;
    }

    try {
      await removeReaction(
        chatId,
        reactionMessage.id,
        meId
      );
    } catch (error) {
      console.log(
        'Remove reaction error:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Could not remove reaction.'
      );
    } finally {
      setReactionMessage(null);
      setReactionEmoji(null);
    }
  };

  /* =======================================================
     UNSEND
  ======================================================= */

  const handleUnsend = async () => {
    if (!menuMessage?.id) {
      return;
    }

    closeMenu();

    try {
      await unsendMessage(
        chatId,
        menuMessage.id,
        meId
      );
    } catch (error) {
      console.log(
        'Unsend error:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Could not unsend message.'
      );
    }
  };

  /* =======================================================
     DELETE FOR ME
  ======================================================= */

  const handleDeleteForMe = async () => {
    if (!menuMessage?.id) {
      return;
    }

    closeMenu();

    try {
      await deleteMessageForMe(
        chatId,
        menuMessage.id,
        meId
      );
    } catch (error) {
      console.log(
        'Delete error:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Could not delete message.'
      );
    }
  };

  /* =======================================================
     COPY
  ======================================================= */

  const handleCopy = async () => {
    if (!menuMessage?.text) {
      return;
    }

    try {
      await Clipboard.setStringAsync(
        menuMessage.text
      );
    } catch (error) {
      console.log(
        'Copy error:',
        error
      );
    }

    closeMenu();
  };

  /* =======================================================
     FORWARD
  ======================================================= */

  const toggleFriend = friendId => {
    setSelectedFriends(
      current => {
        if (
          current.includes(friendId)
        ) {
          return current.filter(
            id => id !== friendId
          );
        }

        return [
          ...current,
          friendId,
        ];
      }
    );
  };

  const openForward = () => {
    if (!menuMessage) {
      return;
    }

    setSelectedFriends([]);

    closeMenu();

    setTimeout(() => {
      setShowForward(true);
    }, 120);
  };

  const handleForward = async () => {
    if (!menuMessage?.text) {
      return;
    }

    if (
      selectedFriends.length === 0
    ) {
      Alert.alert(
        'Select friends',
        'Choose at least one friend.'
      );

      return;
    }

    try {
      setSending(true);

      for (
        const friendId of selectedFriends
      ) {
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
      console.log(
        'Forward error:',
        error
      );

      Alert.alert(
        'Forward failed',
        error?.message ||
          'Could not forward the message.'
      );
    } finally {
      setSending(false);
    }
  };

  /* =======================================================
     SEND
  ======================================================= */

  const handleSend = async () => {
    const cleanText =
      text.trim();

    if (
      !cleanText ||
      sending
    ) {
      return;
    }

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
              senderId:
                replyingTo.senderId,
              senderName:
                replyingTo.senderId ===
                meId
                  ? 'You'
                  : replyingTo.senderName ||
                    otherName ||
                    'Message',
            }
          : null
      );

      setText('');
      setReplyingTo(null);

      Keyboard.dismiss();
    } catch (error) {
      console.log(
        'Send message error:',
        error
      );

      Alert.alert(
        'Send failed',
        error?.message ||
          'Could not send message.'
      );
    } finally {
      setSending(false);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  /* =======================================================
     FRIEND LIST
  ======================================================= */

  const friendList = Object.values(
    friendProfiles || {}
  )
    .filter(friend => {
      const id =
        friend?.id ||
        friend?.uid;

      return (
        id &&
        id !== meId
      );
    })
    .map(friend => {
      const id =
        friend?.id ||
        friend?.uid;

      return {
        ...friend,
        id,
        uid: id,
      };
    });

  /* =======================================================
     UI
  ======================================================= */

  return (
    <SafeAreaView
      style={styles.safe}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation?.goBack()
            }
          >
            <Text
              style={styles.backText}
            >
              ‹
            </Text>
          </TouchableOpacity>

          {/* =================================================
              REAL PROFILE PHOTO
          ================================================= */}

          <View style={styles.avatar}>
            {otherPhoto ? (
              <Image
                source={{
                  uri: otherPhoto,
                }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text
                style={styles.avatarText}
              >
                {otherName
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            )}
          </View>

          <View
            style={styles.headerInfo}
          >
            <Text
              style={styles.headerName}
              numberOfLines={1}
            >
              {otherName}
            </Text>

            <Text
              style={
                styles.headerStatus
              }
            >
              {otherProfile?.online
                ? 'Online'
                : 'Messages'}
            </Text>
          </View>
        </View>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {loading ? (
          <View
            style={styles.loading}
          >
            <ActivityIndicator
              size="large"
              color={RED}
            />
          </View>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={item =>
              item.id
            }
            contentContainerStyle={
              styles.messagesList
            }
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <MessageRow
                item={item}
                onLongPress={
                  openMenu
                }
                onReply={
                  handleReply
                }
                onReactionPress={
                  handleReactionPress
                }
                inputRef={inputRef}
              />
            )}
            ListEmptyComponent={
              <View
                style={
                  styles.emptyContainer
                }
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  No messages yet
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Start the conversation 👋
                </Text>
              </View>
            }
          />
        )}

        {/* =================================================
            REPLY COMPOSER
        ================================================= */}

        {replyingTo && (
          <View
            style={
              styles.replyComposer
            }
          >
            <View
              style={
                styles.replyComposerAccent
              }
            />

            <View
              style={
                styles.replyComposerContent
              }
            >
              <Text
                style={
                  styles.replyComposerTitle
                }
                numberOfLines={1}
              >
                Replying to{' '}
                {replyingTo.senderId ===
                meId
                  ? 'yourself'
                  : replyingTo.senderName ||
                    otherName ||
                    'message'}
              </Text>

              <Text
                style={
                  styles.replyComposerText
                }
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {String(
                  replyingTo.text ||
                    'Message'
                )}
              </Text>
            </View>

            <TouchableOpacity
              onPress={cancelReply}
              style={
                styles.replyClose
              }
            >
              <Text
                style={
                  styles.replyCloseText
                }
              >
                ×
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* =================================================
            MESSAGE COMPOSER
        ================================================= */}

        <View
          style={styles.composer}
        >
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
              (!text.trim() ||
                sending) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={
              !text.trim() ||
              sending
            }
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator
                color="#fff"
              />
            ) : (
              <Text
                style={styles.sendText}
              >
                ➤
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* =================================================
            LONG PRESS ACTION MENU
        ================================================= */}

        <Modal
          visible={!!menuMessage}
          transparent
          animationType="none"
          onRequestClose={
            closeMenu
          }
        >
          <View
            style={
              styles.modalBackdrop
            }
          >
            <Pressable
              style={
                StyleSheet.absoluteFill
              }
              onPress={
                closeMenu
              }
            />

            <Animated.View
              style={[
                styles.actionSheet,
                {
                  opacity:
                    menuAnim,

                  transform: [
                    {
                      translateY:
                        menuAnim.interpolate(
                          {
                            inputRange: [
                              0,
                              1,
                            ],
                            outputRange: [
                              18,
                              0,
                            ],
                          }
                        ),
                    },

                    {
                      scale:
                        menuAnim.interpolate(
                          {
                            inputRange: [
                              0,
                              1,
                            ],
                            outputRange: [
                              0.97,
                              1,
                            ],
                          }
                        ),
                    },
                  ],
                },
              ]}
            >
              <View
                style={
                  styles.quickReactionRow
                }
              >
                {QUICK_REACTIONS.map(
                  emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={
                        styles.quickReaction
                      }
                      onPress={() =>
                        handleReaction(
                          emoji
                        )
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
                  )
                )}

                <TouchableOpacity
                  style={[
                    styles.quickReaction,
                    styles.plusReaction,
                  ]}
                  onPress={() =>
                    setShowExtraReactions(
                      true
                    )
                  }
                >
                  <Text
                    style={
                      styles.plusReactionText
                    }
                  >
                    +
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={
                  styles.menuDivider
                }
              />

              <ActionButton
                icon="↩"
                label="Reply"
                onPress={() =>
                  handleReply(
                    menuMessage
                  )
                }
              />

              <ActionButton
                icon="➤"
                label="Forward"
                onPress={
                  openForward
                }
              />

              <ActionButton
                icon="⧉"
                label="Copy"
                onPress={
                  handleCopy
                }
              />

              {menuMessage?.senderId ===
                meId &&
                !menuMessage?.unsent && (
                  <ActionButton
                    icon="↶"
                    label="Unsend"
                    danger
                    onPress={
                      handleUnsend
                    }
                  />
                )}

              <ActionButton
                icon="⌫"
                label="Delete for you"
                danger
                onPress={
                  handleDeleteForMe
                }
              />

              <ActionButton
                icon="×"
                label="Cancel"
                onPress={
                  closeMenu
                }
              />
            </Animated.View>
          </View>
        </Modal>

        {/* =================================================
            EXTRA REACTIONS
        ================================================= */}

        <Modal
          visible={
            showExtraReactions
          }
          transparent
          animationType="slide"
          onRequestClose={() =>
            setShowExtraReactions(
              false
            )
          }
        >
          <View
            style={
              styles.modalBackdrop
            }
          >
            <Pressable
              style={
                StyleSheet.absoluteFill
              }
              onPress={() =>
                setShowExtraReactions(
                  false
                )
              }
            />

            <View
              style={
                styles.reactionSheet
              }
            >
              <View
                style={
                  styles.sheetHandle
                }
              />

              <Text
                style={
                  styles.sheetTitle
                }
              >
                Choose reaction
              </Text>

              <ScrollView
                contentContainerStyle={
                  styles.emojiGrid
                }
              >
                {EXTRA_REACTIONS.map(
                  emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={
                        styles.bigEmojiButton
                      }
                      onPress={async () => {
                        await handleReaction(
                          emoji
                        );

                        setShowExtraReactions(
                          false
                        );
                      }}
                    >
                      <Text
                        style={
                          styles.bigEmoji
                        }
                      >
                        {emoji}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* =================================================
            REMOVE REACTION
        ================================================= */}

        <Modal
          visible={
            !!reactionMessage
          }
          transparent
          animationType="fade"
          onRequestClose={() => {
            setReactionMessage(
              null
            );

            setReactionEmoji(
              null
            );
          }}
        >
          <View
            style={
              styles.modalBackdrop
            }
          >
            <Pressable
              style={
                StyleSheet.absoluteFill
              }
              onPress={() => {
                setReactionMessage(
                  null
                );

                setReactionEmoji(
                  null
                );
              }}
            />

            <View
              style={
                styles.reactionPopup
              }
            >
              <Text
                style={
                  styles.reactionPopupEmoji
                }
              >
                {reactionEmoji}
              </Text>

              <Text
                style={
                  styles.reactionPopupTitle
                }
              >
                Remove your reaction?
              </Text>

              <TouchableOpacity
                style={
                  styles.redButton
                }
                onPress={
                  removeMyReaction
                }
              >
                <Text
                  style={
                    styles.redButtonText
                  }
                >
                  Remove
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.cancelButton
                }
                onPress={() => {
                  setReactionMessage(
                    null
                  );

                  setReactionEmoji(
                    null
                  );
                }}
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* =================================================
            FORWARD
        ================================================= */}

        <Modal
          visible={showForward}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setShowForward(false)
          }
        >
          <View
            style={
              styles.modalBackdrop
            }
          >
            <View
              style={
                styles.forwardSheet
              }
            >
              <View
                style={
                  styles.sheetHandle
                }
              />

              <View
                style={
                  styles.forwardHeader
                }
              >
                <Text
                  style={
                    styles.sheetTitle
                  }
                >
                  Forward to
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setShowForward(
                      false
                    )
                  }
                >
                  <Text
                    style={
                      styles.closeText
                    }
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>

              {friendList.length ===
              0 ? (
                <View
                  style={
                    styles.noFriends
                  }
                >
                  <Text
                    style={
                      styles.noFriendsTitle
                    }
                  >
                    No friends available
                  </Text>

                  <Text
                    style={
                      styles.noFriendsText
                    }
                  >
                    Your friend list is
                    empty.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={
                    styles.friendScroll
                  }
                  contentContainerStyle={
                    styles.friendList
                  }
                >
                  {friendList.map(
                    friend => {
                      const selected =
                        selectedFriends.includes(
                          friend.id
                        );

                      return (
                        <TouchableOpacity
                          key={
                            friend.id
                          }
                          style={
                            styles.friendRow
                          }
                          onPress={() =>
                            toggleFriend(
                              friend.id
                            )
                          }
                          activeOpacity={
                            0.75
                          }
                        >
                          <View
                            style={
                              styles.friendAvatar
                            }
                          >
                            {friend.photoURL ? (
                              <Image
                                source={{
                                  uri: friend.photoURL,
                                }}
                                style={
                                  styles.friendAvatarImage
                                }
                              />
                            ) : (
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
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}
                              </Text>
                            )}
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
                              numberOfLines={
                                1
                              }
                            >
                              {friend.displayName ||
                                friend.name ||
                                'User'}
                            </Text>

                            <Text
                              style={
                                styles.friendUsername
                              }
                              numberOfLines={
                                1
                              }
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
                    }
                  )}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[
                  styles.forwardButton,
                  (selectedFriends.length ===
                    0 ||
                    sending) &&
                    styles.forwardButtonDisabled,
                ]}
                disabled={
                  selectedFriends.length ===
                    0 ||
                  sending
                }
                onPress={
                  handleForward
                }
              >
                {sending ? (
                  <ActivityIndicator
                    color="#fff"
                  />
                ) : (
                  <Text
                    style={
                      styles.forwardButtonText
                    }
                  >
                    Forward
                    {selectedFriends.length >
                    0
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

/* =========================================================
   ACTION BUTTON
========================================================= */

function ActionButton({
  icon,
  label,
  onPress,
  danger = false,
}) {
  return (
    <TouchableOpacity
      style={
        styles.actionButton
      }
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.actionIcon,
          danger &&
            styles.actionIconDanger,
        ]}
      >
        <Text
          style={[
            styles.actionIconText,
            danger &&
              styles.actionIconTextDanger,
          ]}
        >
          {icon}
        </Text>
      </View>

      <Text
        style={[
          styles.actionLabel,
          danger &&
            styles.actionLabelDanger,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  container: {
    flex: 1,
    backgroundColor: BG,
  },

  /* =======================================================
     HEADER
  ======================================================= */

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
    overflow: 'hidden',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },

  headerInfo: {
    flex: 1,
    minWidth: 0,
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
    width: '100%',
  },

  messageAnimated: {
    maxWidth: '84%',
  },

  /* =======================================================
     MESSAGE BUBBLE
  ======================================================= */

  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minWidth: 50,
    maxWidth: '100%',
    overflow: 'hidden',
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
    flexShrink: 1,
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

  /* =======================================================
     CLEAN REPLY QUOTE
  ======================================================= */

  replyQuote: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    backgroundColor: '#350B10',
    borderRadius: 9,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#61151C',
  },

  replyAccent: {
    width: 4,
    backgroundColor: RED,
    alignSelf: 'stretch',
  },

  replyQuoteContent: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  replyQuoteTitle: {
    color: '#FF5962',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 3,
  },

  replyQuoteText: {
    color: '#D6A6AA',
    fontSize: 12,
    lineHeight: 17,
    flexShrink: 1,
  },

  /* =======================================================
     REACTIONS
  ======================================================= */

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

  /* =======================================================
     SEEN
  ======================================================= */

  seenText: {
    color: '#777',
    fontSize: 10,
    marginTop: 3,
    marginHorizontal: 4,
  },

  /* =======================================================
     EMPTY
  ======================================================= */

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

  /* =======================================================
     REPLY COMPOSER
  ======================================================= */

  replyComposer: {
    minHeight: 62,
    backgroundColor: '#101010',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
  },

  replyComposerAccent: {
    width: 4,
    height: 44,
    backgroundColor: RED,
  },

  replyComposerContent: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  replyComposerTitle: {
    color: RED,
    fontWeight: '800',
    fontSize: 12,
  },

  replyComposerText: {
    color: '#AAA',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    flexShrink: 1,
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

  /* =======================================================
     COMPOSER
  ======================================================= */

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

  /* =======================================================
     MODALS
  ======================================================= */

  modalBackdrop: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  actionSheet: {
    backgroundColor: '#151515',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom:
      Platform.OS === 'ios'
        ? 28
        : 16,
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
    backgroundColor:
      'rgba(225,29,42,0.16)',
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

  /* =======================================================
     REACTIONS SHEET
  ======================================================= */

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

  /* =======================================================
     REACTION POPUP
  ======================================================= */

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

  /* =======================================================
     FORWARD
  ======================================================= */

  forwardSheet: {
    maxHeight: '82%',
    backgroundColor: '#151515',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom:
      Platform.OS === 'ios'
        ? 28
        : 15,
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
    overflow: 'hidden',
  },

  friendAvatarImage: {
    width: '100%',
    height: '100%',
  },

  friendAvatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  friendInfo: {
    flex: 1,
    minWidth: 0,
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