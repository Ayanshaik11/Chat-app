import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import { onColor, themeThumbUrl } from '../utils/chatTheme';

/**
 * A small, self-contained mock of the chat rendered entirely with a theme's own
 * colours. Used by the picker so a user can preview a look before applying it.
 */
export default function ChatThemePreview({ theme, name = 'Your friend', height = 430 }) {
  if (!theme) return null;

  const bubble = (mine, text, extra) => (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        marginVertical: 5,
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 16,
        backgroundColor: mine ? theme.outgoingBubbleColor : theme.incomingBubbleColor,
        borderWidth: mine ? 0 : 1,
        borderColor: theme.borderColor,
        borderBottomRightRadius: mine ? 4 : 16,
        borderBottomLeftRadius: mine ? 16 : 4,
        ...extra,
      }}
    >
      <Text style={{ color: mine ? theme.youText : theme.text, fontSize: 14 }}>{text}</Text>
    </View>
  );

  return (
    <View
      style={{
        borderRadius: 26,
        borderWidth: 2,
        borderColor: theme.accentColor,
        overflow: 'hidden',
        height,
        backgroundColor: theme.backgroundColor,
      }}
    >
      {!!theme.wallpaperUrl && (
        <Image
          source={{ uri: themeThumbUrl(theme.wallpaperUrl) || theme.wallpaperUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      {!theme.wallpaperUrl && (
        <LinearGradient
          colors={[theme.backgroundColor, theme.incomingBubbleColor]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundOverlayColor }]} />

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.02)']} style={{ flex: 1 }}>
        {/* header */}
        <View
          style={{
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            backgroundColor: theme.header,
            borderBottomWidth: 1,
            borderBottomColor: theme.borderColor,
          }}
        >
          <FontAwesome name="angle-left" size={26} color={theme.text} />
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: theme.accentColor,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 12,
            }}
          >
            <FontAwesome name="user" size={15} color={onColor(theme.accentColor)} />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={{ color: theme.headerTextColor, fontWeight: '700' }} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ color: theme.statusColor, fontSize: 11 }}>Online</Text>
          </View>
          <FontAwesome name="ellipsis-v" size={18} color={theme.iconColor} />
        </View>

        {/* messages */}
        <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          {bubble(false, 'Bro, ready for the next project?')}
          {/* incoming message with a reply preview */}
          <View
            style={{
              alignSelf: 'flex-start',
              maxWidth: '86%',
              marginVertical: 5,
              paddingHorizontal: 13,
              paddingVertical: 9,
              borderRadius: 16,
              borderBottomLeftRadius: 4,
              backgroundColor: theme.incomingBubbleColor,
              borderWidth: 1,
              borderColor: theme.borderColor,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: theme.replyPreviewColor,
                marginBottom: 7,
              }}
            >
              <View style={{ width: 4, backgroundColor: theme.accentColor }} />
              <View style={{ paddingHorizontal: 9, paddingVertical: 5 }}>
                <Text style={{ color: theme.accentColor, fontSize: 11, fontWeight: '800' }}>You</Text>
                <Text style={{ color: theme.replyText, fontSize: 12 }}>Always! Let's make it epic</Text>
              </View>
            </View>
            <Text style={{ color: theme.text, fontSize: 14 }}>
              King X is not just a chat… it's a movement
            </Text>
            <Text style={{ color: theme.timestampColor, fontSize: 10, marginTop: 3 }}>09:41</Text>
          </View>
          {bubble(true, "Let's go ⚡")}
        </View>

        {/* composer */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 10,
            backgroundColor: theme.header,
            borderTopWidth: 1,
            borderTopColor: theme.borderColor,
          }}
        >
          <View
            style={{
              flex: 1,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.inputBackgroundColor,
              borderWidth: 1,
              borderColor: theme.borderColor,
              justifyContent: 'center',
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ color: theme.placeholderColor }}>Message...</Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.sendButtonColor,
              marginLeft: 8,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: theme.glowColor || 'transparent',
              shadowOpacity: theme.glowIntensity || 0,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
              elevation: 6,
            }}
          >
            <FontAwesome name="send" size={16} color={theme.sendText || onColor(theme.sendButtonColor)} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
