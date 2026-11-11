import { router } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HeaderIconButton,
  MoniButton,
} from '@/components/ui/header-icon-button';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/ui/user-avatar';
import { tid, type Screen } from '@/lib/test-ids';
import { springs } from '@/lib/motion/tokens';

export type PageHeader =
  | {
      kind: 'home';
      initial: string;
      /** The account's photo, such as from Google; the initial shows without one. */
      photoUrl: string | null;
      date: string;
      greeting: string;
      onAvatarPress: () => void;
      onAskMoni: () => void;
    }
  | { kind: 'tabRoot'; title: string; trailing?: ReactNode }
  | {
      kind: 'pushed';
      title: string;
      subtitle?: string;
      trailing?: ReactNode;
      onBack?: () => void;
    }
  | {
      kind: 'task';
      title: string;
      subtitle?: string;
      trailing?: ReactNode;
      onClose?: () => void;
    }
  /** No header row, content still from y 104 (sign-in). */
  | { kind: 'bare' };

export type PageProps = PageHeader & {
  /** Prefixes the header controls' testIDs: `<screen>.back`, `<screen>.ask-moni`. */
  screen: Screen;
  children: ReactNode;
};

/**
 * Full-screen page chrome from tokens.md: the real top inset, a 44 header row
 * with 20 sides, and content 12 below it (y 104 on a 48 inset). Tab roots
 * leave the bottom to the tab bar; other kinds keep the bottom inset.
 */
export function Page(props: PageProps) {
  const insets = useSafeAreaInsets();
  const onTab = props.kind === 'home' || props.kind === 'tabRoot';
  const lift = useSharedValue(0);
  const lifted = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.get() }],
  }));
  return (
    <PageLift.Provider value={lift}>
      <View className="flex-1 bg-canvas">
        <Animated.View
          className="flex-1"
          style={[
            {
              paddingTop: insets.top,
              paddingBottom: onTab ? 0 : insets.bottom,
            },
            lifted,
          ]}
        >
          <View className="h-11 flex-row items-center gap-3 px-5">
            <HeaderRow {...props} />
          </View>
          <View className="flex-1 pt-3">{props.children}</View>
        </Animated.View>
      </View>
    </PageLift.Provider>
  );
}

const PageLift = createContext<SharedValue<number> | null>(null);

/**
 * Slides the page up so an open field's controls clear the keyboard, as `V2A-TxnDetailEdit` draws
 * for the note. Android's pan only keeps the caret visible, which leaves Save under the keyboard.
 */
export function usePageLift() {
  const lift = useContext(PageLift);
  return {
    current: () => lift?.get() ?? 0,
    to: (by: number) => {
      if (lift) lift.set(withSpring(by, springs.sheet));
    },
  };
}

function Trailing({ children }: { children: ReactNode }) {
  return children ? (
    <View className="flex-row items-center gap-2">{children}</View>
  ) : null;
}

function HeaderRow(props: PageProps) {
  switch (props.kind) {
    case 'home':
      return (
        <>
          <Press
            testID={tid(props.screen, 'avatar')}
            onPress={props.onAvatarPress}
            accessibilityLabel="Profile and settings"
            radius={{ rest: 16, pressed: 12 }}
            className="h-11 w-11"
          >
            <UserAvatar
              initial={props.initial}
              photoUrl={props.photoUrl}
              size="header"
            />
          </Press>
          <View className="min-w-0 flex-1">
            <Text
              variant="meta"
              className="text-muted"
              numberOfLines={1}
            >
              {props.date}
            </Text>
            <Text
              variant="rowTitle"
              className="text-foreground"
              numberOfLines={1}
            >
              {props.greeting}
            </Text>
          </View>
          <MoniButton
            testID={tid(props.screen, 'ask-moni')}
            onPress={props.onAskMoni}
          />
        </>
      );
    case 'tabRoot':
      return (
        <>
          <Text
            variant="screenTitle"
            className="flex-1 text-foreground"
            accessibilityRole="header"
            numberOfLines={1}
          >
            {props.title}
          </Text>
          <Trailing>{props.trailing}</Trailing>
        </>
      );
    case 'pushed':
    case 'task': {
      const back = props.kind === 'pushed';
      const leave =
        (back ? props.onBack : props.onClose) ??
        (() => router.back());
      return (
        <>
          <HeaderIconButton
            testID={tid(props.screen, back ? 'back' : 'close')}
            icon={back ? 'chevron-left' : 'close'}
            glyphSize={22}
            accessibilityLabel={back ? 'Back' : 'Close'}
            onPress={leave}
          />
          <View className="min-w-0 flex-1">
            <Text
              variant="cardTitle"
              className="text-foreground"
              accessibilityRole="header"
              numberOfLines={1}
            >
              {props.title}
            </Text>
            {props.subtitle ? (
              <Text
                variant="meta"
                className="text-muted"
                numberOfLines={1}
              >
                {props.subtitle}
              </Text>
            ) : null}
          </View>
          <Trailing>{props.trailing}</Trailing>
        </>
      );
    }
    case 'bare':
      return null;
  }
}
