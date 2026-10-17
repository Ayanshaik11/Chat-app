import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import ChatThemePicker from './ChatThemePicker';

// The 3-dot menu of a chat. To add another option later, add one line here.
const OPTIONS = [
  { key: 'theme', icon: 'paint-brush', label: 'Change theme', sub: 'Colours and style of this chat' },
];

export default function ChatMenu({ visible, onClose, themeId, name, onApplyTheme, theme }) {
  const [page, setPage] = useState(null);
  const close = () => { setPage(null); onClose(); };

  return (
    <>
      <Modal visible={visible && !page} transparent animationType="fade" onRequestClose={close}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: '#151515', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 14, paddingBottom: 26 }}>
            <View style={{ width: 42, height: 4, borderRadius: 3, backgroundColor: '#555', alignSelf: 'center', marginBottom: 12 }} />
            {OPTIONS.map((o) => (
              <Pressable key={o.key} onPress={() => setPage(o.key)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#252525', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <FontAwesome name={o.icon} size={17} color={theme?.accent || '#fff'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '600' }}>{o.label}</Text>
                  <Text style={{ color: '#8F8F8F', fontSize: 12 }}>{o.sub}</Text>
                </View>
                <FontAwesome name="angle-right" size={20} color="#777" />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <ChatThemePicker visible={visible && page === 'theme'} current={themeId || 'default'} name={name} onClose={close} onApply={onApplyTheme} />
    </>
  );
}
