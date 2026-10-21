import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

/** V2H-Profile draws its bubbles as light pastels on Paper. */
export type ProfileTint =
  | 'mint'
  | 'lemon'
  | 'lilac'
  | 'peach'
  | 'aqua'
  | 'sand';

const tintClass: Record<ProfileTint, string> = {
  mint: 'bg-mint/45',
  lemon: 'bg-lemon/45',
  lilac: 'bg-lilac/45',
  peach: 'bg-peach/45',
  aqua: 'bg-aqua/45',
  sand: 'bg-sand',
};

type ProfileRowProps = {
  icon: IconSymbolName;
  tint: ProfileTint;
  title: string;
  meta?: string;
  value?: string;
  /** Main currency shows its code in ink 700, other values stay Ink 2. */
  strongValue?: boolean;
} & (
  | {
      testID: TestId;
      onPress: () => void;
      /** Chevron down for a picker, right for a page. */
      chevron?: 'down' | 'right';
      accessory?: never;
    }
  | { testID?: never; onPress?: never; chevron?: never; accessory: ReactNode }
);

/** A settings row with a meta line: 42 bubble, 16/600 title, 13 meta, trailing value and chevron. */
export function ProfileRow(props: ProfileRowProps) {
  const tokens = useThemeTokens();
  const body = (
    <>
      <View
        className={`h-[42px] w-[42px] items-center justify-center rounded-full ${tintClass[props.tint]}`}
      >
        <IconSymbol
          name={props.icon}
          size={20}
          color={tokens.foreground}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {props.title}
        </Text>
        {props.meta ? (
          <Text
            variant="meta"
            className="text-muted"
            numberOfLines={1}
          >
            {props.meta}
          </Text>
        ) : null}
      </View>
      {props.value ? (
        <Text
          className={`text-[15px] leading-5 ${props.strongValue ? 'font-display-bold text-foreground' : 'text-ink-2'}`}
          numberOfLines={1}
        >
          {props.value}
        </Text>
      ) : null}
    </>
  );

  if (!props.onPress) {
    return (
      <View className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3">
        {body}
        {props.accessory}
      </View>
    );
  }

  return (
    <Press
      testID={props.testID}
      onPress={props.onPress}
      accessibilityLabel={[props.title, props.meta, props.value]
        .filter(Boolean)
        .join(', ')}
      className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
    >
      {body}
      {props.chevron ? (
        <IconSymbol
          name={props.chevron === 'down' ? 'chevron-down' : 'chevron-right'}
          size={20}
          color={tokens.muted}
        />
      ) : null}
    </Press>
  );
}
