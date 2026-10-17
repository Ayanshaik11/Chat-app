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
import StoryEditor from '../components/StoryEditor';
import EditedVideo from '../components/EditedVideo';
import Btn from '../components/Btn';
import T from '../components/T';

// mode = 'post' -> photo | 'story' -> photo or video | 'reel' -> video. All of them open the editor.
const TITLES = { post: 'New post', story: 'New story', reel: 'New reel' };

export default function CreateScreen({ route, navigation }) {
  const mode = route.params?.mode || 'post';
  const isStory = mode === 'story', isReel = mode === 'reel';
  const { me } = useAuth();
  const { colors, fonts } = useTheme();
  const { width, height } = useWindowDimensions();

  const [asset, setAsset] = useState(null); // what gets uploaded (edited picture, or video + edit)
  const [original, setOriginal] = useState(null); // what was picked, kept for the editor
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(null);
  const uploading = progress !== null;

  const pick = async () => {
    try {
      const a = await pickMedia({ source: 'gallery', video: isStory || isReel });
      if (a) { setOriginal(a); setEditing(true); }
    } catch (e) {
      Alert.alert('Could not open', e?.message || 'Unable to open your photos and videos.');
    }
  };

  const share = async () => {
    if (!asset || uploading) return;
    setProgress(0);
    try {
      if (isStory) await createStory(me, asset, setProgress);
      else if (isReel) await createReel(me, asset, caption, setProgress);
      else await createPost(me, asset, caption, setProgress);
      navigation.goBack();
    } catch (e) {
      setProgress(null);
      Alert.alert('Upload failed', e?.message || 'Something went wrong while uploading.');
    }
  };

  const boxW = isReel ? width * 0.72 : isStory ? width * 0.62 : width - 40;
  const boxH = isReel ? Math.min(height * 0.6, boxW * 1.78) : isStory ? boxW * 1.7 : boxW;
  const input = { alignSelf: 'stretch', backgroundColor: colors.inputBg, borderRadius: 14, padding: 14, textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 15, color: colors.text };
  const hint = (text) => <T size={12} color="subtext" style={{ textAlign: 'center' }}>{text}</T>;
  const full = { width: '100%', height: '100%' };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={TITLES[mode]} onBack={() => !uploading && navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, alignItems: 'center' }} keyboardShouldPersistTaps="handled">

          <Pressable
            onPress={pick}
            disabled={uploading}
            style={{
              width: boxW, height: boxH, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center',
              borderWidth: asset ? 0 : 2, borderStyle: 'dashed', borderColor: colors.border,
            }}
          >
            {asset ? (
              !isVideo(asset)
                ? <Image source={{ uri: asset.uri }} style={full} />
                : asset.edit
                  ? <EditedVideo uri={asset.uri} edit={asset.edit} width={boxW} height={boxH} shouldPlay isLooping isMuted />
                  : <Video source={{ uri: asset.uri }} style={full} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
            ) : (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Ionicons name={isReel ? 'videocam-outline' : 'images-outline'} size={40} color={colors.primary} />
                <T weight="medium">{isReel ? 'Choose a video' : isStory ? 'Choose a photo or video' : 'Choose a photo'}</T>
              </View>
            )}
          </Pressable>

          {asset?.music ? <T size={12} color="subtext">♪ {asset.music.name} · {asset.music.artist}</T> : null}

          {asset && !uploading ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn small variant="soft" label="Edit" icon="color-wand-outline" onPress={() => setEditing(true)} />
              <Btn small variant="soft" label="Change" icon="swap-horizontal-outline" onPress={pick} />
            </View>
          ) : null}

          {isStory ? hint('Stories disappear after 24 hours. Videos can be up to 30 seconds.') : null}

          {!isStory ? (
            <TextInput
              value={caption} onChangeText={setCaption} placeholder="Write a caption…" placeholderTextColor={colors.subtext}
              multiline maxLength={300} editable={!uploading} style={[input, { minHeight: isReel ? 60 : 80 }]}
            />
          ) : null}

          {isReel ? hint('Videos can be up to 30 seconds.') : null}

          <Btn style={{ alignSelf: 'stretch' }} disabled={!asset} loading={uploading} label={isStory ? 'Share to story' : isReel ? 'Share reel' : 'Share post'} onPress={share} />

          {uploading ? <T size={12} color="subtext">Uploading… {Math.round(progress * 100)}%</T> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {editing && original ? (
        <StoryEditor
          asset={original}
          ratio={isStory || isReel ? 9 / 16 : 1}
          allowMusic
          onCancel={() => setEditing(false)}
          onDone={(edited) => { setAsset(edited); setEditing(false); }}
        />
      ) : null}
    </Screen>
  );
}
