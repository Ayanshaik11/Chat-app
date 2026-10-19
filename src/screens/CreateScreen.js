import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import { isVideo, pickMany, pickMedia } from '../services/media';
import { createPost } from '../services/posts';
import { createStory } from '../services/stories';
import { createReel } from '../services/reels';

import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import StoryEditor from '../components/StoryEditor';
import EditedVideo from '../components/EditedVideo';
import MusicPicker from '../components/MusicPicker';
import Btn from '../components/Btn';
import T from '../components/T';

// mode = 'post' -> up to 10 photos (swipeable) | 'story' -> photo or video | 'reel' -> video. All can open the editor.
const TITLES = { post: 'New post', story: 'New story', reel: 'New reel' };
const MAX_PHOTOS = 10;

export default function CreateScreen({ route, navigation }) {
  const mode = route.params?.mode || 'post';
  const isStory = mode === 'story', isReel = mode === 'reel', isPost = !isStory && !isReel;
  const { me } = useAuth();
  const { colors, fonts } = useTheme();
  const { width, height } = useWindowDimensions();

  const [asset, setAsset] = useState(null); // story / reel: what gets uploaded (edited picture, or video + edit)
  const [photos, setPhotos] = useState([]); // post: the photos, in order
  const [cur, setCur] = useState(0); // post: which photo is shown big
  const [song, setSong] = useState(null); // post: the song
  const [pickSong, setPickSong] = useState(false);
  const [original, setOriginal] = useState(null); // what is open in the editor
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(null);
  const uploading = progress !== null;
  const shown = isPost ? photos[cur] : asset;
  const ready = isPost ? photos.length > 0 : !!asset;

  const fail = (title) => (e) => Alert.alert(title, e?.message || 'Something went wrong.');

  const pick = async () => {
    try {
      const a = await pickMedia({ source: 'gallery', video: isStory || isReel });
      if (a) { setOriginal(a); setEditing(true); }
    } catch (e) { fail('Could not open')(e); }
  };

  // posts: choose several photos at once. A single photo opens the editor like before.
  const addPhotos = async () => {
    try {
      const list = await pickMany({ max: MAX_PHOTOS - photos.length });
      if (!list.length) return;
      setPhotos((l) => [...l, ...list]);
      setCur(photos.length);
      if (!photos.length && list.length === 1) { setOriginal(list[0]); setEditing(true); }
    } catch (e) { fail('Could not open')(e); }
  };

  const openEditor = () => { setOriginal(isPost ? photos[cur].source || photos[cur] : original); setEditing(true); };

  const edited = (e) => {
    setEditing(false);
    if (!isPost) return setAsset(e);
    const { music, ...pic } = e; // the editor's song belongs to the whole post
    if (music) setSong(music);
    setPhotos((l) => (l.length && l[cur] && (l[cur].source || l[cur]).uri === original.uri ? l.map((p, i) => (i === cur ? { ...pic, source: original } : p)) : [...l, { ...pic, source: original }]));
  };

  const removePhoto = (i) => { setPhotos((l) => l.filter((_, j) => j !== i)); setCur((c) => Math.max(0, Math.min(c, photos.length - 2))); };

  const share = async () => {
    if (!ready || uploading) return;
    setProgress(0);
    try {
      if (isStory) await createStory(me, asset, setProgress);
      else if (isReel) await createReel(me, asset, caption, setProgress);
      else await createPost(me, photos, caption, setProgress, song);
      navigation.goBack();
    } catch (e) {
      setProgress(null);
      fail('Upload failed')(e);
    }
  };

  const boxW = isReel ? width * 0.72 : isStory ? width * 0.62 : width - 40;
  const boxH = isReel ? Math.min(height * 0.6, boxW * 1.78) : isStory ? boxW * 1.7 : boxW;
  const input = { alignSelf: 'stretch', backgroundColor: colors.inputBg, borderRadius: 14, padding: 14, textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 15, color: colors.text };
  const hint = (text) => <T size={12} color="subtext" style={{ textAlign: 'center' }}>{text}</T>;
  const full = { width: '100%', height: '100%' };
  const songText = (m) => `♪ ${m.name} · ${m.artist}`;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={TITLES[mode]} onBack={() => !uploading && navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, alignItems: 'center' }} keyboardShouldPersistTaps="handled">

          <Pressable
            onPress={isPost ? (photos.length ? openEditor : addPhotos) : pick}
            disabled={uploading}
            style={{
              width: boxW, height: boxH, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center',
              borderWidth: shown ? 0 : 2, borderStyle: 'dashed', borderColor: colors.border,
            }}
          >
            {shown ? (
              !isVideo(shown)
                ? <Image source={{ uri: shown.uri }} style={full} />
                : shown.edit
                  ? <EditedVideo uri={shown.uri} edit={shown.edit} width={boxW} height={boxH} shouldPlay isLooping isMuted />
                  : <Video source={{ uri: shown.uri }} style={full} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
            ) : (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Ionicons name={isReel ? 'videocam-outline' : 'images-outline'} size={40} color={colors.primary} />
                <T weight="medium">{isReel ? 'Choose a video' : isStory ? 'Choose a photo or video' : 'Choose photos'}</T>
                {isPost ? <T size={12} color="subtext">Up to {MAX_PHOTOS} photos</T> : null}
              </View>
            )}
            {isPost && photos.length > 1 ? (
              <View style={{ position: 'absolute', top: 10, right: 10, paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' }}>
                <T size={11} weight="semibold" color="#fff">{cur + 1}/{photos.length}</T>
              </View>
            ) : null}
          </Pressable>

          {/* post: small pictures to choose, remove or add to */}
          {isPost && photos.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ alignSelf: 'stretch' }} contentContainerStyle={{ gap: 8 }}>
              {photos.map((p, i) => (
                <Pressable key={`${i}-${p.uri}`} onPress={() => setCur(i)} style={{ width: 62, height: 62, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: i === cur ? colors.primary : 'transparent' }}>
                  <Image source={{ uri: p.uri }} style={full} />
                  {!uploading ? (
                    <Pressable onPress={() => removePhoto(i)} hitSlop={6} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  ) : null}
                </Pressable>
              ))}
              {photos.length < MAX_PHOTOS && !uploading ? (
                <Pressable onPress={addPhotos} style={{ width: 62, height: 62, borderRadius: 10, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={26} color={colors.primary} />
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}

          {asset?.music ? <T size={12} color="subtext">{songText(asset.music)}</T> : null}

          {shown && !uploading ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn small variant="soft" label="Edit" icon="color-wand-outline" onPress={openEditor} />
              {isPost
                ? <Btn small variant="soft" label={song ? 'Change song' : 'Add song'} icon="musical-notes-outline" onPress={() => setPickSong(true)} />
                : <Btn small variant="soft" label="Change" icon="swap-horizontal-outline" onPress={pick} />}
            </View>
          ) : null}

          {isPost && song ? (
            <Pressable onPress={() => setSong(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T size={12} color="subtext">{songText(song)}</T>
              <Ionicons name="close-circle" size={16} color={colors.subtext} />
            </Pressable>
          ) : null}

          {isStory ? hint('Stories disappear after 24 hours. Videos can be up to 30 seconds.') : null}

          {!isStory ? (
            <TextInput
              value={caption} onChangeText={setCaption} placeholder="Write a caption…" placeholderTextColor={colors.subtext}
              multiline maxLength={300} editable={!uploading} style={[input, { minHeight: isReel ? 60 : 80 }]}
            />
          ) : null}

          {isReel ? hint('Videos can be up to 30 seconds.') : null}

          <Btn style={{ alignSelf: 'stretch' }} disabled={!ready} loading={uploading} label={isStory ? 'Share to story' : isReel ? 'Share reel' : 'Share post'} onPress={share} />

          {uploading ? <T size={12} color="subtext">Uploading… {Math.round(progress * 100)}%</T> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {editing && original ? (
        <StoryEditor asset={original} ratio={isStory || isReel ? 9 / 16 : 1} allowMusic onCancel={() => setEditing(false)} onDone={edited} />
      ) : null}

      {/* post: pick a song without opening the editor */}
      <Modal visible={pickSong} animationType="slide" onRequestClose={() => setPickSong(false)}>
        <MusicPicker initial={song} onClose={() => setPickSong(false)} onPick={(m) => { setSong(m); setPickSong(false); }} />
      </Modal>
    </Screen>
  );
}
