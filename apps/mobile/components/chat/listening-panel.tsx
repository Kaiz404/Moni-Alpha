import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

/**
 * While the user talks to Moni: the words heard so far, centred over the foot of the thread above
 * the listening composer. Touches pass through to the thread.
 */
export function ListeningPanel({ transcript, hint }: { transcript: string; hint: string }) {
  const tokens = useThemeTokens();
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeInUp.duration(260)}
      exiting={FadeOut.duration(180)}
      className="absolute left-0 right-0 items-center justify-end"
      style={{ bottom: '100%', height: 180 }}
    >
      <LinearGradient
        colors={[`${tokens.canvas}00`, tokens.canvas, tokens.canvas]}
        locations={[0, 0.3, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <Text
        testID={tid('chat', 'listen', 'transcript')}
        accessibilityLiveRegion="polite"
        variant="sectionTitle"
        className={`max-w-[320px] px-5 pb-4 pt-3 text-center ${transcript ? 'text-foreground' : 'text-muted'}`}
        numberOfLines={3}
      >
        {transcript || hint}
      </Text>
    </Animated.View>
  );
}
