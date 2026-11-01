import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { readBatteryExemption, type BatteryExemption } from '@/lib/notifications/battery';

/** Read live, because the answer changes in a system dialog Moni does not see close. */
export function useBatteryExemption(): BatteryExemption | 'checking' {
  const [state, setState] = useState<BatteryExemption | 'checking'>('checking');
  const refresh = useCallback(() => {
    void readBatteryExemption().then(setState);
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return state;
}
