import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * The time, kept fresh for a home screen's date and greeting: it moves on at
 * the top of every hour (the greeting changes at noon and 6 PM, the date at
 * midnight) and whenever the app comes back to the front. Without it, an app
 * left open overnight greets you with yesterday's date.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    const timer = setTimeout(() => setNow(new Date()), next.getTime() - now.getTime() + 500);
    return () => clearTimeout(timer);
  }, [now]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => sub.remove();
  }, []);

  return now;
}
