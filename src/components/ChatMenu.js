import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import ChatThemePicker from './ChatThemePicker';
import { getTheme } from '../utils/chatTheme';

// The 3-dot menu of a chat. To add another option later, add one line here.
const OPTIONS = [
  { key: 'theme', icon: 'paint-brush', label: 'Chat wallpaper', sub: 'Colours and wallpaper of this chat' },
];

export default function ChatMenu({ visible, onClose, themeId, name, onApplyTheme, onResetTheme, theme }) {
  const [page, setPage] = useState(null);
  const close = () => {
    setPage(null);
    onClose();
  };

  const t = theme || getTheme(themeId);
  const sheetBg = t.elevated;

  return (
    <>
      <Modal visible={visible && !page} transparent animationType="fade" onRequestClose={close}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 14, paddingBottom: 26 }}>
            <View style={{ width: 42, height: 4, borderRadius: 3, backgroundColor: t.borderColor, alignSelf: 'center', marginBottom: 12 }} />
            {OPTIONS.map((o) => (
              <Pressable key={o.key} onPress={() => setPage(o.key)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.inputBackgroundColor, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <FontAwesome name={o.icon} size={17} color={t.iconColor || t.accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '600' }}>{o.label}</Text>
                  <Text style={{ color: t.timestampColor, fontSize: 12 }}>{o.sub}</Text>
                </View>
                <FontAwesome name="angle-right" size={20} color={t.timestampColor} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <ChatThemePicker
        visible={visible && page === 'theme'}
        current={themeId || 'default'}
        name={name}
        onClose={close}
        onApply={onApplyTheme}
        onReset={onResetTheme}
      />
    </>
  );
}
