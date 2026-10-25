import { transactionSourceSchema, type TransactionSource } from '@repo/types';
import { View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

const SOURCES: Record<TransactionSource, { label: string; icon: IconSymbolName }> = {
  manual: { label: 'Manual', icon: 'pencil-outline' },
  voice: { label: 'Voice', icon: 'microphone-outline' },
  moni: { label: 'Moni', icon: 'creation' },
  notification: { label: 'Notification', icon: 'bell-outline' },
  camera: { label: 'Camera', icon: 'camera-outline' },
};

/** `metadata.source` of a synced row; rows from before sources existed read as Manual. */
export function transactionSource(metadata: unknown): TransactionSource {
  let value = metadata;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  const source =
    value && typeof value === 'object' ? (value as { source?: unknown }).source : undefined;
  return transactionSourceSchema.safeParse(source).data ?? 'manual';
}

export function sourceLabel(source: TransactionSource): string {
  return SOURCES[source].label;
}

export type Tile = {
  name: string;
  label: string;
  value: string;
  icon?: IconSymbolName;
  dot?: string | null;
  /** `pick` opens a picker sheet (Sand, chevron down); `link` opens a page (Paper, chevron right). */
  action: { kind: 'pick' | 'link'; onPress: () => void } | null;
};

function DetailTile({ tile }: { tile: Tile }) {
  const tokens = useThemeTokens();
  const pick = tile.action?.kind === 'pick';
  const body = (
    <>
      <Text variant="meta" className="text-muted">
        {tile.label}
      </Text>
      <View className="flex-row items-center gap-1.5">
        {tile.dot ? (
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tile.dot }} />
        ) : null}
        {tile.icon ? <IconSymbol name={tile.icon} size={18} color={tokens.foreground} /> : null}
        <Text variant="rowTitle" className="min-w-0 flex-shrink text-foreground" numberOfLines={1}>
          {tile.value}
        </Text>
        {tile.action ? (
          <View className="ml-auto">
            <IconSymbol
              name={pick ? 'chevron-down' : 'chevron-right'}
              size={18}
              color={tokens.ink2}
            />
          </View>
        ) : null}
      </View>
    </>
  );
  const className = `min-h-[64px] flex-1 justify-center gap-0.5 rounded-field px-3.5 py-2 ${pick ? 'bg-sand' : 'bg-card'}`;
  return tile.action ? (
    <Press
      testID={tid('txn', 'tile', tile.name)}
      accessibilityLabel={`${tile.label}, ${tile.value}. ${pick ? 'Change' : 'Open'}`}
      onPress={tile.action.onPress}
      pressedClassName={pick ? 'bg-hairline' : 'bg-sand-light'}
      className={className}
    >
      {body}
    </Press>
  ) : (
    <View className={className} accessibilityLabel={`${tile.label}, ${tile.value}`}>
      {body}
    </View>
  );
}

export function DetailTiles({ tiles }: { tiles: [Tile, Tile, Tile, Tile] }) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <DetailTile tile={tiles[0]} />
        <DetailTile tile={tiles[1]} />
      </View>
      <View className="flex-row gap-2">
        <DetailTile tile={tiles[2]} />
        <DetailTile tile={tiles[3]} />
      </View>
    </View>
  );
}

export function sourceIcon(source: TransactionSource): IconSymbolName {
  return SOURCES[source].icon;
}
