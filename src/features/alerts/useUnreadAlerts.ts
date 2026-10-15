import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { alertKeys, fetchAlerts } from '../../api/alerts';

/** How many Focus alerts are unread, for the dot on the bell. Checked again each time the screen is shown. */
export function useUnreadAlerts(): number {
  const alerts = useQuery({ queryKey: alertKeys.list, queryFn: fetchAlerts, staleTime: 30_000, refetchInterval: 120_000 });
  const { refetch } = alerts;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  return alerts.data?.unread ?? 0;
}
