import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import { isVideo, pickMedia } from '../services/media';
import { createPost } from '../services/posts';
import { createStory } from '../services/stories';
import { createReel } from '../services/reels';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Btn from '../components/Btn';
import T from '../components/T';

// mode = 'post' (photos only) | 'story' (photo or video, disappears after 24h) | 'reel' (video only)
export default function CreateScreen({ route, navigation }) {
  const mode = route.params?.mode || 'post';
  const isStory = mode === 'story';
  const isReel = mode === 'reel';
  const isVideoMode = isStory || isReel;
  const { me } = useAuth();
  const { colors, fonts } = useTheme();
  const { width, height } = useWindowDimensions();
  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(null);
  const uploading = progress !== null;

  const titles = { post: 'New post', story: 'New story', reel: 'New reel' };

  const pick = async (source) => {
    try {
      const a = await pickMedia({ source, video: isVideoMode, square: !isVideoMode });
      if (a) setAsset(a);
    } catch (e) {
      Alert.alert('Could not open', e.message);
    }
  };

  const choose = () =>
    Alert.alert(titles[mode], 'Choose a source', [
      { text: 'Gallery', onPress: () => pick('gallery') },
      { text: 'Camera', onPress: () => pick('camera') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const share = async () => {
    if (!asset) return;
    setProgress(0);
    try {
      if (isStory) await createStory(me, asset, setProgress);
      else if (isReel) await createReel(me, asset, caption, setProgress);
      else await createPost(me, asset, caption, setProgress);
      navigation.goBack();
    } catch (e) {
      setProgress(null);
      Alert.alert('Upload failed', e.message);
    }
  };

  const boxW = isReel ? width * 0.72 : isStory ? width * 0.62 : width - 40;
  const boxH = isReel ? Math.min(height * 0.6, boxW * 1.78) : isStory ? boxW * 1.7 : boxW;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={titles[mode]} onBack={() => !uploading && navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={choose} disabled={uploading}
            style={{
              width: boxW, height: boxH, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.inputBg,
              alignItems: 'center', justifyContent: 'center', borderWidth: asset ? 0 : 2, borderStyle: 'dashed', borderColor: colors.border,
            }}
          >
            {asset ? (
              isVideo(asset) ? (
                <Video source={{ uri: asset.uri }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
              ) : (
                <Image source={{ uri: asset.uri }} style={{ width: '100%', height: '100%' }} />
              )
            ) : (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Ionicons name={isReel ? 'videocam-outline' : 'images-outline'} size={40} color={colors.primary} />
                <T weight="medium">
                  {isReel ? 'Choose a video' : isStory ? 'Choose a photo or video' : 'Choose a photo'}
                </T>
              </View>
            )}
          </Pressable>

          {asset && !uploading ? <Btn small variant="soft" label="Change" icon="swap-horizontal-outline" onPress={choose} /> : null}

          {isStory ? (
            <T size={12} color="subtext" style={{ textAlign: 'center' }}>
              Stories disappear after 24 hours. Videos can be up to 30 seconds.
            </T>
          ) : isReel ? (
            <TextInput
              value={caption} onChangeText={setCaption} placeholder="Write a caption…" placeholderTextColor={colors.subtext}
              multiline maxLength={300} editable={!uploading}
              style={{
                alignSelf: 'stretch', minHeight: 60, backgroundColor: colors.inputBg, borderRadius: 14, padding: 14,
                textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 15, color: colors.text,
              }}
            />
          ) : (
            <TextInput
              value={caption} onChangeText={setCaption} placeholder="Write a caption…" placeholderTextColor={colors.subtext}
              multiline maxLength={300} editable={!uploading}
              style={{
                alignSelf: 'stretch', minHeight: 80, backgroundColor: colors.inputBg, borderRadius: 14, padding: 14,
                textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 15, color: colors.text,
              }}
            />
          )}
          {isReel ? (
            <T size={12} color="subtext" style={{ textAlign: 'center' }}>Videos can be up to 30 seconds.</T>
          ) : null}

          <Btn
            style={{ alignSelf: 'stretch' }} disabled={!asset} loading={uploading}
            label={isStory ? 'Share to story' : isReel ? 'Share reel' : 'Share post'}
            onPress={share}
          />
          {uploading ? <T size={12} color="subtext">Uploading… {Math.round(progress * 100)}%</T> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
