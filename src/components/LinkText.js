import React from 'react';
import { Linking, Text } from 'react-native';

const URL_RE = /((?:https?:\/\/|www\.)[^\s]+)/gi;

/** Text that turns links into tappable, underlined links that open in the browser. */
export default function LinkText({ children, style, linkStyle }) {
  const value = String(children ?? '');
  const parts = value.split(URL_RE);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part; // plain text (split keeps the matches at odd indexes)

        // keep trailing punctuation out of the link
        const m = part.match(/^(.*?)([.,!?;:)\]]*)$/);
        const url = m[1];
        const tail = m[2];
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;

        return (
          <Text key={i}>
            <Text
              onPress={() => Linking.openURL(href).catch(() => {})}
              style={[{ textDecorationLine: 'underline' }, linkStyle]}
            >
              {url}
            </Text>
            {tail}
          </Text>
        );
      })}
    </Text>
  );
}
