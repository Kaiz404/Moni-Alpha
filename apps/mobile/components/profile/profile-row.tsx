import type { ReactNode } from 'react';
import { View } from 'react-native';

import { MoniGlyph } from '@/components/brand/mascot';
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
  | 'sand'
  | 'attention';

export const PROFILE_TINT_CLASS: Record<ProfileTint, string> = {
  mint: 'bg-mint',
  lemon: 'bg-lemon',
  lilac: 'bg-lilac',
  peach: 'bg-peach',
  aqua: 'bg-aqua',
  sand: 'bg-sand',
  attention: 'bg-attention-fill',
};

type ProfileRowProps = {
  /** `moni` draws the cat, the mark for Moni's AI. */
  icon: IconSymbolName | 'moni';
  tint: ProfileTint;
  title: string;
  meta?: string;
  value?: string;
  /** Main currency shows its code in ink 700, other values stay Ink 2. */
  strongValue?: boolean;
  /** Delete your account titles its row in Over red. */
  over?: boolean;
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

/** A settings row with a meta line: 42 bubble, 16/600 title, 13 meta, trailing value 8 before the chevron. */
export function ProfileRow(props: ProfileRowProps) {
  const tokens = useThemeTokens();
  const glyphColor =
    props.tint === 'sand' || props.tint === 'attention'
      ? tokens.foreground
      : tokens.onCategory;
  const body = (
    <>
      <View
        className={`h-[42px] w-[42px] items-center justify-center rounded-full ${PROFILE_TINT_CLASS[props.tint]}`}
      >
        {props.icon === 'moni' ? (
          <MoniGlyph size={20} color={glyphColor} />
        ) : (
          <IconSymbol name={props.icon} size={20} color={glyphColor} />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className={props.over ? 'text-over' : 'text-foreground'}
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
          className={`text-[15px] leading-5 ${props.chevron ? '-mr-1.5' : ''} ${props.strongValue ? 'font-display-bold text-foreground' : 'text-ink-2'}`}
          numberOfLines={1}
        >
          {props.value}
        </Text>
      ) : null}
    </>
  );

  if (!props.onPress) {
    return (
      <View className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3">
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
