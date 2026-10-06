import React, {
  useMemo,
  useState,
} from 'react';

import {
  FlatList,
  Pressable,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';

import {
  chatIdFor,
} from '../services/chat';

import {
  isOnline,
  timeAgo,
  toMillis,
} from '../utils/helpers';

import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

export default function MessagesScreen({
  navigation,
}) {
  const { me } = useAuth();

  const {
    friends,
    chats,
  } = useAppData();

  const {
    colors,
    fonts,
  } = useTheme();

  const [text, setText] = useState('');

  /* =======================================================
     RECENT CHATS
  ======================================================= */

  const rows = useMemo(() => {
    const myId = me?.id || me?.uid;

    if (!myId) {
      return [];
    }

    const q = text.trim().toLowerCase();

    return (friends || [])
      .filter(friend => {
        if (!q) {
          return true;
        }

        return (
          (friend.name || '')
            .toLowerCase()
            .includes(q) ||
          (friend.displayName || '')
            .toLowerCase()
            .includes(q) ||
          (friend.email || '')
            .toLowerCase()
            .includes(q)
        );
      })
      .map(friend => {
        const friendId =
          friend.id ||
          friend.uid;

        if (!friendId) {
          return {
            friend,
            chat: null,
            lastActivity: 0,
          };
        }

        const chatId =
          chatIdFor(
            myId,
            friendId
          );

        const chat =
          chats?.[chatId] || null;

        /*
         * lastMessageAt is the real ordering
         * value.
         *
         * updatedAt is only a fallback for
         * older chat documents created before
         * lastMessageAt was added.
         */
        const lastMessageAt =
          chat
            ? toMillis(
                chat.lastMessageAt
              )
            : 0;

        const updatedAt =
          chat
            ? toMillis(
                chat.updatedAt
              )
            : 0;

        const lastActivity =
          lastMessageAt ||
          updatedAt ||
          0;

        return {
          friend,
          friendId,
          chat,
          lastActivity,
        };
      })
      .sort((a, b) => {
        return (
          b.lastActivity -
          a.lastActivity
        );
      });
  }, [
    friends,
    chats,
    text,
    me?.id,
    me?.uid,
  ]);

  /* =======================================================
     ROW
  ======================================================= */

  const renderItem = ({
    item,
  }) => {
    const {
      friend,
      friendId,
      chat,
    } = item;

    const myId =
      me?.id ||
      me?.uid;

    const unread =
      chat?.unread?.[myId] || 0;

    const friendName =
      friend.name ||
      friend.displayName ||
      'User';

    const photoURL =
      friend.photoURL ||
      friend.photoUrl ||
      friend.profilePic ||
      friend.avatar ||
      '';

    const preview =
      chat?.lastMessage
        ? `${
            chat.lastSender === myId
              ? 'You: '
              : ''
          }${chat.lastMessage}`
        : 'Say hi 👋';

    return (
      <Pressable
        onPress={() =>
          navigation.navigate(
            'Chat',
            {
              user: me,

              otherUser: {
                id: friendId,

                name:
                  friendName,

                displayName:
                  friend.displayName ||
                  friendName,

                photoURL,

                email:
                  friend.email ||
                  '',
              },
            }
          )
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',

          paddingHorizontal: 16,
          paddingVertical: 10,

          gap: 12,

          backgroundColor:
            pressed
              ? colors.inputBg
              : 'transparent',
        })}
      >
        <Avatar
          uri={photoURL}
          name={friendName}
          size={54}
          online={isOnline(friend)}
        />

        <View
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <T
            weight={
              unread
                ? 'bold'
                : 'semibold'
            }
            numberOfLines={1}
          >
            {friendName}
          </T>

          <T
            size={13}
            color={
              unread
                ? 'text'
                : 'subtext'
            }
            weight={
              unread
                ? 'medium'
                : 'regular'
            }
            numberOfLines={1}
          >
            {preview}
          </T>
        </View>

        <View
          style={{
            alignItems: 'flex-end',
            gap: 6,
          }}
        >
          {chat?.lastMessageAt ? (
            <T
              size={11}
              color="subtext"
            >
              {timeAgo(
                chat.lastMessageAt
              )}
            </T>
          ) : null}

          {unread > 0 ? (
            <View
              style={{
                backgroundColor:
                  colors.primary,

                minWidth: 20,
                height: 20,

                borderRadius: 10,

                paddingHorizontal: 5,

                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T
                size={11}
                weight="bold"
                color="#fff"
              >
                {unread}
              </T>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  /* =======================================================
     SCREEN
  ======================================================= */

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        <T
          weight="bold"
          size={24}
        >
          Messages
        </T>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',

            backgroundColor:
              colors.inputBg,

            borderRadius: 14,

            paddingHorizontal: 12,

            marginTop: 12,

            height: 44,

            gap: 8,
          }}
        >
          <Ionicons
            name="search"
            size={19}
            color={
              colors.subtext
            }
          />

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search friends"
            placeholderTextColor={
              colors.subtext
            }
            style={{
              flex: 1,

              fontFamily:
                fonts.regular,

              fontSize: 14,

              color:
                colors.text,
            }}
          />
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={item =>
          item.friendId ||
          item.friend.id ||
          item.friend.uid
        }
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"

        /*
         * This makes the list immediately
         * reflect chat-summary changes.
         */
        removeClippedSubviews={false}

        ListEmptyComponent={
          <EmptyState
            title="No messages"
            subtitle="Start a conversation with a friend."
          />
        }
      />
    </Screen>
  );
}