import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  View,
} from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

type DeferredSectionProps = {
  children: ReactNode;
  minHeight?: number;
};

/** Mount children after navigation/animations settle so the shell paints first. */
export function DeferredSection({
  children,
  minHeight = 200,
}: DeferredSectionProps) {
  const tokens = useThemeTokens();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() =>
      setReady(true),
    );
    return () => task.cancel();
  }, []);

  if (!ready) {
    return (
      <View
        className="items-center justify-center rounded-2xl bg-card"
        style={{ minHeight }}
      >
        <ActivityIndicator
          size="small"
          color={tokens.primary}
        />
      </View>
    );
  }

  return <>{children}</>;
}
