'use client';

import { useRef, useCallback } from 'react';

/** Mobile-friendly long-press (and desktop mouse-hold) gesture handler. */
export function useLongPress(onLongPress, { delay = 450 } = {}) {
  const timer = useRef(null);

  const start = useCallback(
    (e) => {
      timer.current = setTimeout(() => onLongPress(e), delay);
    },
    [onLongPress, delay],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchEnd: clear,
  };
}

export default useLongPress;
