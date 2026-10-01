import React from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Vibration,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  useAuth,
} from '../context/AuthContext';

import {
  useSettings,
  useTheme,
} from '../context/SettingsContext';

import {
  CURRENT_VERSION,
} from '../config/appVersion';

import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import T from '../components/T';


function Section({
  title,
  children,
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        marginTop: 22,
      }}
    >
      <T
        weight="semibold"
        size={13}
        color="subtext"
        style={{
          marginBottom: 8,
          marginLeft: 4,
        }}
      >
        {title}
      </T>

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}


function Row({
  icon,
  label,
  hint,
  right,
  onPress,
  danger,
  last,
}) {
  const { colors } = useTheme();

  const tint =
    danger
      ? colors.danger
      : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,

        borderBottomWidth:
          last ? 0 : 1,

        borderBottomColor:
          colors.border,

        backgroundColor:
          pressed
            ? colors.inputBg
            : 'transparent',
      })}
    >
      <Ionicons
        name={icon}
        size={22}
        color={tint}
      />

      <View
        style={{
          flex: 1,
        }}
      >
        <T
          weight="medium"
          color={
            danger
              ? 'danger'
              : 'text'
          }
        >
          {label}
        </T>

        {hint ? (
          <T
            size={12}
            color="subtext"
          >
            {hint}
          </T>
        ) : null}
      </View>

      {right}
    </Pressable>
  );
}


function ThemeChoice() {
  const { colors } = useTheme();

  const {
    settings,
    setSetting,
  } = useSettings();

  const options = [
    {
      key: 'light',
      label: 'Light',
      icon: 'sunny-outline',
    },
    {
      key: 'dark',
      label: 'Dark',
      icon: 'moon-outline',
    },
    {
      key: 'system',
      label: 'System',
      icon: 'phone-portrait-outline',
    },
  ];


  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        padding: 12,
      }}
    >
      {options.map((option) => {
        const active =
          settings.themeMode ===
          option.key;

        return (
          <Pressable
            key={option.key}
            onPress={() =>
              setSetting(
                'themeMode',
                option.key
              )
            }
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1.5,

              borderColor:
                active
                  ? colors.primary
                  : colors.border,

              backgroundColor:
                active
                  ? colors.inputBg
                  : 'transparent',
            }}
          >
            <Ionicons
              name={option.icon}
              size={22}
              color={
                active
                  ? colors.primary
                  : colors.subtext
              }
            />

            <T
              size={12}
              weight={
                active
                  ? 'semibold'
                  : 'regular'
              }
              color={
                active
                  ? 'primary'
                  : 'subtext'
              }
            >
              {option.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}


export default function SettingsScreen({
  navigation,
}) {
  const {
    me,
    logout,
    setActivityStatus,
  } = useAuth();

  const { colors } =
    useTheme();

  const {
    settings,
    setSetting,
  } = useSettings();


  /*
   * Activity Status now comes
   * directly from Firestore.
   *
   * It survives logout/login.
   */
  const activityEnabled =
    me?.showOnline !== false;


  const switchProps = {
    trackColor: {
      false: colors.border,
      true: colors.primary,
    },

    thumbColor: '#fff',
  };


  const confirmLogout = () =>
    Alert.alert(
      'Log out?',
      'You can log back in with your Google account anytime.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Log out',
          style: 'destructive',

          onPress: () =>
            logout(),
        },
      ]
    );


  return (
    <Screen>

      <ScreenHeader
        title="Settings"
        onBack={() =>
          navigation.goBack()
        }
      />


      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
        }}
      >

        {/* PROFILE */}

        <Pressable
          onPress={() =>
            navigation.navigate(
              'EditProfile'
            )
          }

          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,

            backgroundColor:
              colors.card,

            borderRadius: 18,

            padding: 14,

            borderWidth: 1,

            borderColor:
              colors.border,
          }}
        >

          <Avatar
            uri={me?.photoURL}
            name={me?.name}
            size={56}
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
              {me?.name || 'User'}
            </T>


            <T
              size={12}
              color="subtext"
              numberOfLines={1}
            >
              {me?.email || ''}
            </T>

          </View>


          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.subtext}
          />

        </Pressable>


        {/* APPEARANCE */}

        <Section title="Appearance">

          <ThemeChoice />

        </Section>


        {/* PREFERENCES */}

        <Section title="Preferences">

          {/* VIBRATION */}

          <Row
            icon="phone-portrait-outline"
            label="Vibration"
            hint="Vibrate for new messages, likes and alerts"

            right={
              <Switch
                {...switchProps}

                value={
                  settings.vibration
                }

                onValueChange={(value) => {

                  setSetting(
                    'vibration',
                    value
                  );


                  if (value) {
                    Vibration.vibrate(
                      60
                    );
                  }

                }}
              />
            }
          />


          {/* ACTIVITY STATUS */}

          <Row
            icon="radio-button-on-outline"
            label="Show online status"
            hint="Let friends see when you are online"
            last

            right={
              <Switch
                {...switchProps}

                value={
                  activityEnabled
                }

                onValueChange={async (
                  value
                ) => {
                  try {
                    await setActivityStatus(
                      value
                    );
                  } catch (error) {
                    Alert.alert(
                      'Could not update',
                      'Please try again.'
                    );
                  }
                }}
              />
            }
          />

        </Section>


        {/* ACCOUNT */}

        <Section title="Account">

          <Row
            icon="create-outline"
            label="Edit profile"
            onPress={() =>
              navigation.navigate(
                'EditProfile'
              )
            }

            right={
              <Ionicons
                name="chevron-forward"
                size={18}
                color={
                  colors.subtext
                }
              />
            }
          />


          <Row
            icon="log-out-outline"
            label="Log out"
            danger
            onPress={
              confirmLogout
            }
            last
          />

        </Section>


        {/* ABOUT */}

        <Section title="About">

          <Row
            icon="information-circle-outline"
            label="King X"
            hint={`Version ${CURRENT_VERSION}`}
          />


          <Row
            icon="cube-outline"
            label="Package"
            hint="com.chat.app"
            last
          />

        </Section>

      </ScrollView>

    </Screen>
  );
}