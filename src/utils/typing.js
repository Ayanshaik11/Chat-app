import { useEffect, useRef, useState } from 'react';

const TYPING_FRESH_MS = 6000;

/**
 * Is the other person typing RIGHT NOW?
 *
 * The sender keeps writing a changing number (Date.now()) while typing and 0
 * when done. We never trust the stored value on its own — an old value that was
 * never cleared (app closed, phone offline) used to show "typing..." forever.
 * Instead we only say "typing" when we see the value CHANGE, and drop it again
 * if nothing new arrives for 6 seconds. (Comparing against our own clock avoids
 * trouble from the two phones' clocks being different.)
 */
export function usePeerTyping(value) {
  const [typing, setTyping] = useState(false);
  const last = useRef(undefined);
  const timer = useRef(null);

  useEffect(() => {
    const number = typeof value === 'number' && value > 0 ? value : 0;

    // first value we ever see is only the starting point, never "typing"
    if (last.current === undefined) {
      last.current = number;
      return;
    }

    if (!number) {
      last.current = 0;
      clearTimeout(timer.current);
      setTyping(false);
      return;
    }

    if (number !== last.current) {
      last.current = number;
      setTyping(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setTyping(false), TYPING_FRESH_MS);
    }
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return typing;
}
