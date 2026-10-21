import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

type MapHeaderProps = {
  /** testID scope: `map.places.back` on the map, `map.place.back` on a place. */
  scope: 'places' | 'place';
  title: string;
  subtitle?: string;
  action: {
    name: string;
    icon: IconSymbolName;
    label: string;
    onPress: () => void;
  };
};

/** Paper fill so a header circle reads over map tiles. */
function OnMap({ children }: { children: React.ReactNode }) {
  return <View className="rounded-full bg-card">{children}</View>;
}

/**
 * The pushed-page header floating over a map, as XM-Places and XM-Detail draw
 * it: a cream fade behind the back button, title, and one trailing action.
 */
export function MapHeader({ scope, title, subtitle, action }: MapHeaderProps) {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 top-0"
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${tokens.canvas}F5`, `${tokens.canvas}DB`, `${tokens.canvas}00`]}
        locations={[0, 0.62, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 84 }}
      />
      <View
        pointerEvents="box-none"
        className="h-11 flex-row items-center gap-3 px-5"
        style={{ marginTop: insets.top }}
      >
        <OnMap>
          <HeaderIconButton
            testID={tid('map', scope, 'back')}
            icon="chevron-left"
            glyphSize={22}
            accessibilityLabel="Back"
            onPress={() => router.back()}
          />
        </OnMap>
        <View
          pointerEvents="none"
          className="min-w-0 flex-1"
        >
          <Text
            variant="cardTitle"
            className="text-foreground"
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="meta"
              className="text-ink-2"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <OnMap>
          <HeaderIconButton
            testID={tid('map', scope, action.name)}
            icon={action.icon}
            accessibilityLabel={action.label}
            onPress={action.onPress}
          />
        </OnMap>
      </View>
    </View>
  );
}
