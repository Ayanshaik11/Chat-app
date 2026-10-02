import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import { extOf, mimeOf, pickMedia, uploadFile } from '../services/media';
import { updateProfile } from '../services/users';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import Btn from '../components/Btn';
import T from '../components/T';

function Field({ label, value, onChangeText, multiline, maxLength, editable = true, autoCapitalize }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T size={13} weight="medium" color="subtext">{label}</T>
      <TextInput
        value={value} onChangeText={onChangeText} multiline={multiline} maxLength={maxLength} editable={editable}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.subtext}
        style={{
          backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
          minHeight: multiline ? 96 : 48, textAlignVertical: multiline ? 'top' : 'center',
          fontFamily: fonts.regular, fontSize: 15, color: editable ? colors.text : colors.subtext,
        }}
      />
    </View>
  );
}

export default function EditProfileScreen({ navigation }) {
  const { me } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState(me.name || '');
  const [username, setUsername] = useState(me.username || '');
  const [about, setAbout] = useState(me.about || '');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  const pick = async (source) => {
    try {
      const a = await pickMedia({ source, square: true });
      if (a) setPhoto(a);
    } catch (e) {
      Alert.alert('Could not open', e.message);
    }
  };

  const choosePhoto = () =>
    Alert.alert('Profile photo', undefined, [
      { text: 'Gallery', onPress: () => pick('gallery') },
      { text: 'Camera', onPress: () => pick('camera') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name needed', 'Please enter your name.');
    setSaving(true);
    try {
      let photoURL = me.photoURL || '';
      if (photo) {
        const mime = mimeOf(photo);
        photoURL = await uploadFile(photo.uri, `avatars/${me.id}/avatar_${Date.now()}.${extOf(mime)}`, mime);
      }
      const cleanUser = username.trim().replace(/^@/, '').replace(/\s+/g, '').toLowerCase();
      await updateProfile(me.id, {
        name: name.trim(),
        username: cleanUser || me.username,
        about: about.trim(),
        photoURL,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Edit profile" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={choosePhoto} style={{ alignSelf: 'center', alignItems: 'center', gap: 10 }}>
            <View>
              <Avatar uri={photo?.uri || me.photoURL} name={name} size={104} />
              <View
                style={{
                  position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17,
                  backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
                  borderWidth: 3, borderColor: colors.bg,
                }}
              >
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </View>
            <T color="primary" weight="medium">Change photo</T>
          </Pressable>

          <Field label="Name" value={name} onChangeText={setName} maxLength={40} />
          <Field label="Username" value={username} onChangeText={setUsername} maxLength={30} autoCapitalize="none" />
          <Field label="About" value={about} onChangeText={setAbout} multiline maxLength={150} />
          <Field label="Gmail (cannot be changed)" value={me.email || ''} editable={false} />

          <Btn label="Save changes" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
