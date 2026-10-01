import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';

import {
  useFocusEffect,
  useIsFocused,
} from '@react-navigation/native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  LinearGradient,
} from 'expo-linear-gradient';

import * as Clipboard from 'expo-clipboard';

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import {
  db,
} from '../config/firebase';

import {
  useAuth,
} from '../context/AuthContext';

import {
  useAppData,
} from '../context/AppDataContext';

import {
  useTheme,
} from '../context/SettingsContext';

import {
  chatIdFor,
  deleteMessageForMe,
  markChatRead,
  reactToMessage,
  sendMessage,
  setTyping,
  unsendMessage,
} from '../services/chat';

import {
  clock,
  isOnline,
  lastSeenText,
  timeAgo,
  toMillis,
} from '../utils/helpers';

import {
  gradientProps,
} from '../theme';

import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import T from '../components/T';


const TYPING_STOP_DELAY_MS = 2500;


const QUICK_REACTIONS = [
  '❤️',
  '😂',
  '😮',
  '😢',
  '👍',
  '🔥',
];


// ==================================================
// Hidden native emoji keyboard input
// ==================================================

function EmojiReactionInput({
  inputRef,
  onEmoji,
}) {
  const handleChange = (value) => {
    if (!value) return;

    /*
     * Because the input is cleared after every selection,
     * the complete value is the newly selected emoji.
     *
     * This is important for emojis such as:
     * ❤️
     * 👍🏽
     * 👨‍👩‍👧‍👦
     * 🥹
     */

    const emoji = value.trim();

    if (!emoji) return;

    onEmoji(emoji);

    inputRef.current?.clear();

    Keyboard.dismiss();
  };


  return (
    <TextInput
      ref={inputRef}
      value=""
      onChangeText={handleChange}

      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        left: -100,
        bottom: 0,
      }}

      autoCorrect={false}
      autoCapitalize="none"

      showSoftInputOnFocus={true}

      keyboardType="default"

      blurOnSubmit={false}
    />
  );
}


// ==================================================
// Typing dots
// ==================================================

function TypingDots() {
  const { colors } = useTheme();

  const dots = [
    useRef(
      new Animated.Value(0)
    ).current,

    useRef(
      new Animated.Value(0)
    ).current,

    useRef(
      new Animated.Value(0)
    ).current,
  ];


  useEffect(() => {
    const anims =
      dots.map(
        (value, index) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(
                index * 150
              ),

              Animated.timing(
                value,
                {
                  toValue: 1,
                  duration: 300,
                  easing: Easing.ease,
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                value,
                {
                  toValue: 0,
                  duration: 300,
                  easing: Easing.ease,
                  useNativeDriver: true,
                }
              ),

              Animated.delay(
                (2 - index) * 150
              ),
            ])
          )
      );


    anims.forEach(
      (animation) =>
        animation.start()
    );


    return () =>
      anims.forEach(
        (animation) =>
          animation.stop()
      );
  }, []);


  return (
    <View
      style={{
        alignSelf: 'flex-start',

        flexDirection: 'row',

        gap: 4,

        backgroundColor:
          colors.bubbleOther,

        borderWidth: 1,

        borderColor:
          colors.border,

        borderRadius: 18,

        borderBottomLeftRadius: 4,

        paddingHorizontal: 14,

        paddingVertical: 12,

        marginBottom: 6,
      }}
    >
      {dots.map(
        (value, index) => (
          <Animated.View
            key={index}

            style={{
              width: 7,

              height: 7,

              borderRadius: 4,

              backgroundColor:
                colors.subtext,

              opacity:
                value.interpolate({
                  inputRange: [
                    0,
                    1,
                  ],

                  outputRange: [
                    0.3,
                    1,
                  ],
                }),

              transform: [
                {
                  translateY:
                    value.interpolate({
                      inputRange: [
                        0,
                        1,
                      ],

                      outputRange: [
                        0,
                        -4,
                      ],
                    }),
                },
              ],
            }}
          />
        )
      )}
    </View>
  );
}


// ==================================================
// Reaction bar
// ==================================================

function ReactionBar({
  message,
  me,
  chatId,
  onMore,
}) {
  const { colors } = useTheme();

  const currentReaction =
    message.reactions?.[me.id] ||
    null;


  const react = async (
    reaction
  ) => {
    try {
      await reactToMessage(
        chatId,
        message,
        me,
        currentReaction === reaction
          ? null
          : reaction
      );
    } catch (error) {
      Alert.alert(
        'Reaction failed',
        'Could not update the reaction.'
      );
    }
  };


  return (
    <View
      style={{
        flexDirection: 'row',

        alignItems: 'center',

        alignSelf: 'flex-start',

        marginTop: 4,

        backgroundColor:
          colors.card,

        borderRadius: 22,

        borderWidth: 1,

        borderColor:
          colors.border,

        paddingHorizontal: 5,

        paddingVertical: 4,
      }}
    >

      {QUICK_REACTIONS.map(
        (reaction) => (
          <Pressable
            key={reaction}

            onPress={() =>
              react(reaction)
            }

            style={{
              width: 36,

              height: 36,

              alignItems:
                'center',

              justifyContent:
                'center',

              borderRadius: 18,

              backgroundColor:
                currentReaction ===
                reaction
                  ? colors.inputBg
                  : 'transparent',
            }}
          >
            <T size={19}>
              {reaction}
            </T>
          </Pressable>
        )
      )}


      {/* + = native Android emoji keyboard */}

      <Pressable
        onPress={onMore}

        style={{
          width: 36,

          height: 36,

          alignItems:
            'center',

          justifyContent:
            'center',

          borderRadius: 18,
        }}
      >
        <Ionicons
          name="add"
          size={22}
          color={colors.subtext}
        />
      </Pressable>

    </View>
  );
}


// ==================================================
// Chat Screen
// ==================================================

export default function ChatScreen({
  route,
  navigation,
}) {
  const { user } =
    route.params;

  const { me } =
    useAuth();

  const {
    chats,
    friendProfiles,
  } = useAppData();

  const {
    colors,
    fonts,
    gradient,
  } = useTheme();

  const isFocused =
    useIsFocused();


  const chatId =
    chatIdFor(
      me.id,
      user.id
    );


  const live =
    friendProfiles[user.id] ||
    user;


  const [
    messages,
    setMessages,
  ] = useState([]);


  const [
    text,
    setText,
  ] = useState('');


  const [
    replyTo,
    setReplyTo,
  ] = useState(null);


  /*
   * Message currently receiving
   * a custom emoji reaction.
   */

  const [
    emojiMessage,
    setEmojiMessage,
  ] = useState(null);


  const amTypingRef =
    useRef(false);


  const typingTimeoutRef =
    useRef(null);


  /*
   * Hidden TextInput used to open
   * the Android emoji keyboard.
   */

  const emojiInputRef =
    useRef(null);


  // ==================================================
  // Messages listener
  // ==================================================

  useEffect(() => {
    const unsubscribe =
      onSnapshot(
        query(
          collection(
            db,
            'chats',
            chatId,
            'messages'
          ),

          orderBy(
            'createdAt',
            'desc'
          ),

          limit(80)
        ),

        (snap) => {
          setMessages(
            snap.docs.map(
              (doc) => ({
                id: doc.id,
                ...doc.data(),
              })
            )
          );
        },

        () => {}
      );


    return unsubscribe;
  }, [chatId]);


  // ==================================================
  // Mark read
  // ==================================================

  useFocusEffect(
    useCallback(() => {
      markChatRead(
        chatId,
        me.id
      ).catch(() => {});
    }, [
      chatId,
      me.id,
    ])
  );


  useEffect(() => {
    if (
      isFocused &&
      messages.length
    ) {
      markChatRead(
        chatId,
        me.id
      ).catch(() => {});
    }
  }, [
    isFocused,
    chatId,
    me.id,
    messages[0]?.id,
  ]);


  // ==================================================
  // Clear typing
  // ==================================================

  useEffect(
    () => {
      return () => {
        clearTimeout(
          typingTimeoutRef.current
        );


        if (
          amTypingRef.current
        ) {
          amTypingRef.current =
            false;

          setTyping(
            chatId,
            me.id,
            false
          );
        }
      };
    },
    [
      chatId,
      me.id,
    ]
  );


  // ==================================================
  // Seen
  // ==================================================

  const lastMine =
    messages[0]?.senderId === me.id
      ? messages[0]
      : null;


  const otherLastRead =
    chats[chatId]
      ?.lastRead
      ?.[user.id];


  const seen =
    lastMine &&
    otherLastRead &&
    toMillis(
      otherLastRead
    ) >=
      toMillis(
        lastMine.createdAt
      );


  // ==================================================
  // Typing
  // ==================================================

  const otherTyping =
    !!chats[chatId]
      ?.typing
      ?.[user.id];


  // ==================================================
  // Text input
  // ==================================================

  const onChangeText = (
    value
  ) => {
    setText(value);


    clearTimeout(
      typingTimeoutRef.current
    );


    if (
      value.trim().length > 0
    ) {
      if (
        !amTypingRef.current
      ) {
        amTypingRef.current =
          true;

        setTyping(
          chatId,
          me.id,
          true
        );
      }


      typingTimeoutRef.current =
        setTimeout(() => {
          amTypingRef.current =
            false;

          setTyping(
            chatId,
            me.id,
            false
          );
        }, TYPING_STOP_DELAY_MS);

    } else if (
      amTypingRef.current
    ) {
      amTypingRef.current =
        false;

      setTyping(
        chatId,
        me.id,
        false
      );
    }
  };


  // ==================================================
  // Send message
  // ==================================================

  const send = async () => {
    const message =
      text.trim();


    if (!message) {
      return;
    }


    setText('');


    clearTimeout(
      typingTimeoutRef.current
    );


    if (
      amTypingRef.current
    ) {
      amTypingRef.current =
        false;

      setTyping(
        chatId,
        me.id,
        false
      );
    }


    try {
      await sendMessage(
        me,
        user,
        message,
        replyTo
      );

      setReplyTo(null);

    } catch (error) {
      setText(message);

      Alert.alert(
        'Message not sent',
        error.message
      );
    }
  };


  // ==================================================
  // Quick reaction
  // ==================================================

  const handleReaction =
    async (
      message,
      reaction
    ) => {
      try {
        const current =
          message.reactions?.[
            me.id
          ] || null;


        await reactToMessage(
          chatId,
          message,
          me,
          current === reaction
            ? null
            : reaction
        );

      } catch {
        Alert.alert(
          'Could not react',
          'Please try again.'
        );
      }
    };


  // ==================================================
  // Open Android emoji keyboard
  // ==================================================

  const openEmojiKeyboard =
    (message) => {
      setEmojiMessage(message);

      /*
       * Wait until React has rendered
       * the hidden input.
       */

      setTimeout(() => {
        emojiInputRef.current?.focus();
      }, 150);
    };


  // ==================================================
  // Custom emoji reaction
  // ==================================================

  const handleEmojiReaction =
    async (emoji) => {
      const message =
        emojiMessage;


      if (
        !message ||
        !emoji
      ) {
        return;
      }


      try {
        const current =
          message.reactions?.[
            me.id
          ] || null;


        await reactToMessage(
          chatId,
          message,
          me,
          current === emoji
            ? null
            : emoji
        );

      } catch {
        Alert.alert(
          'Reaction failed',
          'Could not add this reaction.'
        );
      }


      setEmojiMessage(null);
    };


  // ==================================================
  // Copy
  // ==================================================

  const copyMessage = async (
    message
  ) => {
    if (
      !message.text ||
      message.unsent
    ) {
      return;
    }


    try {
      await Clipboard.setStringAsync(
        message.text
      );
    } catch {
      Alert.alert(
        'Copy failed',
        'Could not copy the message.'
      );
    }
  };


  // ==================================================
  // Reply
  // ==================================================

  const replyMessage = (
    message
  ) => {
    if (
      message.unsent
    ) {
      return;
    }


    setReplyTo(message);
  };


  // ==================================================
  // Unsend
  // ==================================================

  const confirmUnsend =
    (message) => {
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
                  message.id
                );
              } catch {
                Alert.alert(
                  'Could not unsend',
                  'Please try again.'
                );
              }
            },
          },
        ]
      );
    };


  // ==================================================
  // Delete for me
  // ==================================================

  const confirmDeleteForMe =
    (message) => {
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
                  message.id,
                  me.id
                );
              } catch {
                Alert.alert(
                  'Could not delete',
                  'Please try again.'
                );
              }
            },
          },
        ]
      );
    };


  // ==================================================
  // Long press message menu
  // ==================================================

  const showMessageMenu =
    (message) => {
      if (
        message.deletedFor?.[
          me.id
        ]
      ) {
        return;
      }


      const mine =
        message.senderId ===
        me.id;


      const reactionButtons =
        QUICK_REACTIONS.map(
          (reaction) => ({
            text: reaction,

            onPress: () =>
              handleReaction(
                message,
                reaction
              ),
          })
        );


      const actions = [
        ...reactionButtons,

        {
          text: 'Reply',

          onPress: () =>
            replyMessage(
              message
            ),
        },
      ];


      if (
        message.text &&
        !message.unsent
      ) {
        actions.push({
          text: 'Copy',

          onPress: () =>
            copyMessage(
              message
            ),
        });
      }


      if (mine) {
        actions.push({
          text: 'Unsend',

          style: 'destructive',

          onPress: () =>
            confirmUnsend(
              message
            ),
        });
      }


      actions.push({
        text: 'Delete for you',

        style: 'destructive',

        onPress: () =>
          confirmDeleteForMe(
            message
          ),
      });


      actions.push({
        text: 'Cancel',

        style: 'cancel',
      });


      Alert.alert(
        'Message',
        undefined,
        actions
      );
    };


  // ==================================================
  // Render message
  // ==================================================

  const renderItem = ({
    item,
  }) => {
    const mine =
      item.senderId ===
      me.id;


    const hidden =
      item.deletedFor?.[
        me.id
      ];


    if (hidden) {
      return null;
    }


    const showSeen =
      mine &&
      seen &&
      item.id ===
        lastMine?.id;


    const seenLabel =
      showSeen
        ? (
            timeAgo(
              otherLastRead
            ) === 'now'
              ? 'Seen just now'
              : `Seen ${timeAgo(
                  otherLastRead
                )} ago`
          )
        : null;


    const unsent =
      item.unsent;


    return (
      <View
        style={{
          alignSelf:
            mine
              ? 'flex-end'
              : 'flex-start',

          maxWidth: '80%',

          marginVertical: 2,
        }}
      >

        {/* Reply preview */}

        {item.replyTo ? (
          <View
            style={{
              backgroundColor:
                colors.inputBg,

              borderLeftWidth: 3,

              borderLeftColor:
                colors.primary,

              borderRadius: 10,

              paddingHorizontal: 9,

              paddingVertical: 6,

              marginBottom: 3,

              maxWidth: 260,
            }}
          >

            <T
              size={10}
              color="primary"
              weight="semibold"
            >
              {item.replyTo.senderName}
            </T>


            <T
              size={11}
              color="subtext"
              numberOfLines={2}
            >
              {item.replyTo.text}
            </T>

          </View>
        ) : null}


        {/* Message bubble */}

        <Pressable
          onLongPress={() =>
            showMessageMenu(
              item
            )
          }

          delayLongPress={350}

          style={{
            backgroundColor:
              mine
                ? colors.bubbleMine
                : colors.bubbleOther,

            borderRadius: 18,

            borderBottomRightRadius:
              mine ? 4 : 18,

            borderBottomLeftRadius:
              mine ? 18 : 4,

            paddingHorizontal: 13,

            paddingVertical: 8,

            borderWidth:
              mine ? 0 : 1,

            borderColor:
              colors.border,
          }}
        >

          {unsent ? (
            <T
              color="subtext"
              size={14}

              style={{
                fontStyle:
                  'italic',
              }}
            >
              This message was unsent
            </T>
          ) : (
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
          )}


          <T
            size={10}

            color={
              mine
                ? 'rgba(255,255,255,0.75)'
                : 'subtext'
            }

            style={{
              alignSelf:
                'flex-end',

              marginTop: 2,
            }}
          >
            {clock(
              item.createdAt
            )}
          </T>

        </Pressable>


        {/* Reactions */}

        {item.reactions &&
        Object.keys(
          item.reactions
        ).length > 0 ? (
          <View
            style={{
              flexDirection:
                'row',

              alignSelf:
                mine
                  ? 'flex-end'
                  : 'flex-start',

              marginTop: -3,

              marginHorizontal: 8,

              backgroundColor:
                colors.card,

              borderWidth: 1,

              borderColor:
                colors.border,

              borderRadius: 12,

              paddingHorizontal: 6,

              paddingVertical: 2,
            }}
          >

            {Object.entries(
              item.reactions
            ).map(
              ([
                reaction,
                userId,
              ]) => {
                /*
                 * Count identical reactions.
                 */

                const count =
                  Object.values(
                    item.reactions
                  ).filter(
                    (value) =>
                      value ===
                      reaction
                  ).length;


                /*
                 * Only render the first
                 * occurrence of each emoji.
                 */

                const firstIndex =
                  Object.values(
                    item.reactions
                  ).indexOf(
                    reaction
                  );

                const currentIndex =
                  Object.values(
                    item.reactions
                  ).indexOf(
                    userId
                  );


                if (
                  firstIndex !==
                  currentIndex
                ) {
                  return null;
                }


                return (
                  <Pressable
                    key={
                      reaction
                    }

                    onPress={() =>
                      handleReaction(
                        item,
                        reaction
                      )
                    }
                  >
                    <T
                      size={12}

                      style={{
                        marginHorizontal:
                          2,
                      }}
                    >
                      {reaction}

                      {count > 1
                        ? ` ${count}`
                        : ''}
                    </T>
                  </Pressable>
                );
              }
            )}

          </View>
        ) : null}


        {/* Reaction bar */}

        {!unsent ? (
          <ReactionBar
            message={item}

            me={me}

            chatId={chatId}

            onMore={() =>
              openEmojiKeyboard(
                item
              )
            }
          />
        ) : null}


        {/* Seen */}

        {seenLabel ? (
          <T
            size={11}
            color="subtext"

            style={{
              alignSelf:
                'flex-end',

              marginTop: 3,

              marginRight: 2,
            }}
          >
            {seenLabel}
          </T>
        ) : null}

      </View>
    );
  };


  // ==================================================
  // Screen
  // ==================================================

  return (
    <Screen
      edges={[
        'top',
        'bottom',
      ]}
    >

      <ScreenHeader
        onBack={() =>
          navigation.goBack()
        }
      >

        <Pressable
          onPress={() =>
            navigation.navigate(
              'UserProfile',
              {
                userId:
                  user.id,
              }
            )
          }

          style={{
            flexDirection:
              'row',

            alignItems:
              'center',

            gap: 10,
          }}
        >

          <Avatar
            uri={
              live.photoURL
            }

            name={
              live.name
            }

            size={38}

            online={
              isOnline(live)
            }
          />


          <View
            style={{
              flex: 1,
            }}
          >

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
                otherTyping
                  ? 'primary'
                  : isOnline(live)
                    ? 'primary'
                    : 'subtext'
              }
            >
              {otherTyping
                ? 'typing…'
                : lastSeenText(
                    live
                  )}
            </T>

          </View>

        </Pressable>

      </ScreenHeader>


      <KeyboardAvoidingView
        style={{
          flex: 1,
        }}

        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >

        <View
          style={{
            flex: 1,
          }}
        >

          <FlatList
            inverted

            data={messages}

            keyExtractor={(
              message
            ) =>
              message.id
            }

            renderItem={
              renderItem
            }

            contentContainerStyle={{
              padding: 12,

              flexGrow: 1,
            }}

            keyboardShouldPersistTaps="handled"

            ListHeaderComponent={
              otherTyping
                ? <TypingDots />
                : null
            }
          />


          {!messages.length ? (
            <View
              pointerEvents="none"

              style={{
                position:
                  'absolute',

                top: 0,

                left: 0,

                right: 0,

                bottom: 0,

                alignItems:
                  'center',

                justifyContent:
                  'center',

                padding: 30,
              }}
            >

              <T
                color="subtext"

                style={{
                  textAlign:
                    'center',
                }}
              >
                Say hello to{' '}
                {live.name}! 👋
              </T>

            </View>
          ) : null}

        </View>


        {/* Reply composer */}

        {replyTo ? (
          <View
            style={{
              flexDirection:
                'row',

              alignItems:
                'center',

              backgroundColor:
                colors.card,

              borderTopWidth: 1,

              borderTopColor:
                colors.border,

              paddingHorizontal:
                12,

              paddingVertical:
                8,
            }}
          >

            <View
              style={{
                flex: 1,

                borderLeftWidth: 3,

                borderLeftColor:
                  colors.primary,

                paddingLeft: 9,
              }}
            >

              <T
                size={11}

                color="primary"

                weight="semibold"
              >
                Replying to{' '}
                {replyTo.senderId ===
                me.id
                  ? 'yourself'
                  : live.name}
              </T>


              <T
                size={12}

                color="subtext"

                numberOfLines={1}
              >
                {replyTo.text}
              </T>

            </View>


            <Pressable
              onPress={() =>
                setReplyTo(null)
              }

              hitSlop={10}
            >
              <Ionicons
                name="close-circle"

                size={24}

                color={
                  colors.subtext
                }
              />
            </Pressable>

          </View>
        ) : null}


        {/* Composer */}

        <View
          style={{
            flexDirection:
              'row',

            alignItems:
              'flex-end',

            padding: 10,

            gap: 8,

            borderTopWidth:
              replyTo ? 0 : 1,

            borderTopColor:
              colors.border,
          }}
        >

          <TextInput
            value={text}

            onChangeText={
              onChangeText
            }

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

              paddingHorizontal:
                16,

              paddingTop: 10,

              paddingBottom: 10,

              fontFamily:
                fonts.regular,

              fontSize: 15,

              color:
                colors.text,
            }}
          />


          <Pressable
            onPress={send}

            disabled={
              !text.trim()
            }

            style={{
              opacity:
                text.trim()
                  ? 1
                  : 0.45,
            }}
          >

            <LinearGradient
              colors={
                gradient
              }

              {...gradientProps}

              style={{
                width: 44,

                height: 44,

                borderRadius: 22,

                alignItems:
                  'center',

                justifyContent:
                  'center',
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


      {/* ==========================================
          Hidden native emoji keyboard
          ========================================== */}

      <EmojiReactionInput
        inputRef={
          emojiInputRef
        }

        onEmoji={
          handleEmojiReaction
        }
      />

    </Screen>
  );
}