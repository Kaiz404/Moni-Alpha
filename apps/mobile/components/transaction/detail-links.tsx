import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { saveImageLocally, uploadReceiptImage } from '@/lib/receipts/images';
import { setTransactionReceipt } from '@/lib/supabase/transactions';
import { tid } from '@/lib/test-ids';

export type DetailLink = {
  name: string;
  title: string;
  meta: string;
  icon: IconSymbolName;
  trailing: 'chevron-right' | 'plus';
  onPress: () => void;
  bubble?: ReactNode;
};

function LinkRow({ link }: { link: DetailLink }) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('txn', 'link', link.name)}
      accessibilityLabel={`${link.title}, ${link.meta}`}
      onPress={link.onPress}
      className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
    >
      <View className="h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full bg-sand">
        {link.bubble ?? <IconSymbol name={link.icon} size={20} color={tokens.foreground} />}
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="rowTitle" className="text-[15px] leading-[21px] text-foreground" numberOfLines={1}>
          {link.title}
        </Text>
        <Text variant="meta" className="text-muted" numberOfLines={1}>
          {link.meta}
        </Text>
      </View>
      <IconSymbol name={link.trailing} size={20} color={tokens.muted} />
    </Press>
  );
}

/** The board's place bubble: a cream street map with a park and a river, and the pin. */
export function MapThumb() {
  const tokens = useThemeTokens();
  return (
    <Svg width={42} height={42} viewBox="0 0 96 96">
      <Rect width={96} height={96} fill={tokens.sandLight} />
      <Rect x={58} y={50} width={30} height={18} rx={6} fill={tokens.mint} />
      <Path d="M72 0 C 66 18, 84 30, 78 52" stroke={tokens.aqua} strokeWidth={5} fill="none" />
      <Path
        d="M-4 32 C 28 26, 60 42, 100 34"
        stroke={tokens.card}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M30 -4 L 40 100" stroke={tokens.card} strokeWidth={6} fill="none" />
      <Path d="M-4 76 L 100 64" stroke={tokens.card} strokeWidth={4} fill="none" />
      <Path
        d="M48 24 C 40.8 24 36 29 36 36 C 36 45 48 56 48 56 C 48 56 60 45 60 36 C 60 29 55.2 24 48 24 Z"
        fill={tokens.foreground}
      />
      <Circle cx={48} cy={36} r={4.5} fill={tokens.mintKey} />
    </Svg>
  );
}

export function DetailLinks({ links }: { links: DetailLink[] }) {
  return (
    <ListCard>
      {links.map((link) => (
        <LinkRow key={link.name} link={link} />
      ))}
    </ListCard>
  );
}

export function useReceiptLink(
  transactionId: string,
  userId: string | null,
  url: string | null,
): DetailLink {
  const tokens = useThemeTokens();
  const [saving, setSaving] = useState(false);
  if (url)
    return {
      name: 'receipt',
      title: 'Receipt photo',
      meta: 'Open the slip',
      icon: 'receipt-text-outline',
      trailing: 'chevron-right',
      bubble: <Image source={{ uri: url }} style={{ width: 42, height: 42 }} contentFit="cover" />,
      onPress: () => void Linking.openURL(url),
    };
  const add = async () => {
    if (!userId || saving) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    setSaving(true);
    try {
      const local = await saveImageLocally(asset.uri);
      const remote = await uploadReceiptImage(local, userId, transactionId);
      if (!remote) throw new Error('upload');
      setTransactionReceipt(transactionId, remote);
    } catch {
      Alert.alert('Photo not saved', 'Moni needs a connection to keep the photo. Try again when you are online.');
    } finally {
      setSaving(false);
    }
  };
  return {
    name: 'receipt',
    title: 'Add a receipt photo',
    meta: saving ? 'Saving the photo' : 'Keeps the slip with this transaction',
    icon: 'image-plus',
    trailing: 'plus',
    bubble: saving ? <ActivityIndicator size={18} color={tokens.foreground} /> : undefined,
    onPress: () => void add(),
  };
}
