import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const LOOKS = {
  header: { box: 'h-11 w-11 rounded-[16px]', radius: 16, text: 'text-[18px] leading-[22px]' },
  profile: { box: 'h-14 w-14 rounded-[20px]', radius: 20, text: 'text-[24px] leading-[28px]' },
} as const;

/** The account's photo in its Mint rounded square, or its initial when there is none or it fails. */
export function UserAvatar({
  initial,
  photoUrl,
  size,
}: {
  initial: string;
  photoUrl: string | null;
  size: keyof typeof LOOKS;
}) {
  const look = LOOKS[size];
  const [failed, setFailed] = useState<string | null>(null);
  const photo = photoUrl && failed !== photoUrl ? photoUrl : null;
  return (
    <View className={`items-center justify-center overflow-hidden bg-mint ${look.box}`}>
      {photo ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: photo }}
          contentFit="cover"
          transition={150}
          cachePolicy="disk"
          onError={() => setFailed(photo)}
          style={{ width: '100%', height: '100%', borderRadius: look.radius }}
        />
      ) : (
        <Text className={`font-display-bold text-on-category ${look.text}`}>{initial}</Text>
      )}
    </View>
  );
}
