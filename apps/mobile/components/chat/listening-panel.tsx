import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOut, type SharedValue } from 'react-native-reanimated';

import { MicHero } from '@/components/capture/reading-motion';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

const HERO_SCALE = 0.72;
/** MicHero's own height: the 220 mic block, its 28 gap and the 32 wave. */
const HERO_H = 280;

/**
 * While the user talks to Moni: the Say it page's mic hero, smaller, rising over the foot of the
 * thread, with the words heard so far centred under it. Touches pass through to the thread.
 */
export function ListeningPanel({ transcript, level, hint }: { transcript: string; level: SharedValue<number>; hint: string }) {
  const tokens = useThemeTokens();
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeInUp.duration(260)}
      exiting={FadeOut.duration(180)}
      className="absolute left-0 right-0 items-center justify-end"
      style={{ bottom: '100%', height: 420 }}
    >
      <LinearGradient
        colors={[`${tokens.canvas}00`, tokens.canvas, tokens.canvas]}
        locations={[0, 0.3, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View
        className="items-center justify-center"
        style={{ height: HERO_H * HERO_SCALE }}
      >
        <View style={{ transform: [{ scale: HERO_SCALE }] }}>
          <MicHero level={level} />
        </View>
      </View>
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
