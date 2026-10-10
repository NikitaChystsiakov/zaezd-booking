'use client';

import { useCallback, useEffect, useState } from 'react';

export interface UseCooldownReturn {
  active: boolean;
  left: number;
  start: (sec?: number) => void;
}

/**

 * @param defaultSeconds 
 */

export function useCooldown(defaultSeconds = 5): UseCooldownReturn {
  const [until, setUntil] = useState<number>(0); // timestamp
  const [left, setLeft] = useState<number>(0);

  const start = useCallback(
    (sec: number = defaultSeconds) => {
      const u = Date.now() + sec * 1000;
      setUntil(u);
      setLeft(sec);
    },
    [defaultSeconds],
  );

  useEffect(() => {
    if (!until) return;

    const id = setInterval(() => {
      const remain = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(remain);
      if (remain === 0) {
        clearInterval(id);
        setUntil(0);
      }
    }, 250);

    return () => clearInterval(id);
  }, [until]);

  return { active: until > 0, left, start };
}
