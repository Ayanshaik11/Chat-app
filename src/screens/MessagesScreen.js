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

  const [text, setText] =
    useState('');

  /* =======================================================
     RECENT CHATS
  ======================================================= */

  const rows = useMemo(() => {
    if (!me?.id) {
      return [];
    }

    const q =
      text.trim().toLowerCase();

    return friends
      .filter(friend => {
        if (!q) {
          return true;
        }

        return (
          (friend.name || '')
            .toLowerCase()
            .includes(q) ||
          (friend.email || '')
            .toLowerCase()
            .includes(q)
        );
      })
      .map(friend => {
        const chatId =
          chatIdFor(
            me.id,
            friend.id
          );

        const chat =
          chats?.[chatId] || null;

        const lastActivity =
          chat
            ? Math.max(
                toMillis(
                  chat.lastMessageAt
                ),
                toMillis(
                  chat.updatedAt
                )
              )
            : 0;

        return {
          friend,
          chat,
          lastActivity,
        };
      })
      .sort(
        (a, b) =>
          b.lastActivity -
          a.lastActivity
      );
  }, [
    friends,
    chats,
    text,
    me?.id,
  ]);

  /* =======================================================
     ROW
  ======================================================= */

  const renderItem = ({
    item,
  }) => {
    const {
      friend,
      chat,
    } = item;

    const unread =
      chat?.unread?.[me?.id] || 0;

    const preview =
      chat?.lastMessage
        ? `${
            chat.lastSender ===
            me?.id
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
                id: friend.id,

                name:
                  friend.name ||
                  friend.displayName ||
                  'User',

                displayName:
                  friend.displayName ||
                  friend.name ||
                  'User',

                photoURL:
                  friend.photoURL ||
                  friend.photoUrl ||
                  friend.profilePic ||
                  friend.avatar ||
                  '',

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
          uri={
            friend.photoURL ||
            friend.photoUrl ||
            friend.profilePic ||
            friend.avatar
          }
          name={
            friend.name ||
            friend.displayName
          }
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
            {friend.name ||
              friend.displayName ||
              'User'}
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
            alignItems:
              'flex-end',
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

                alignItems:
                  'center',

                justifyContent:
                  'center',
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
            flexDirection:
              'row',

            alignItems:
              'center',

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
            onChangeText={
              setText
            }
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
          item.friend.id
        }
        renderItem={
          renderItem
        }
        keyboardShouldPersistTaps="handled"
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