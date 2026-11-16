import { router } from 'expo-router';

import { ProfileRow } from '@/components/profile/profile-row';
import { tid } from '@/lib/test-ids';

export function ImportDataRow() {
  return (
    <ProfileRow
      testID={tid('profile', 'import')}
      icon="upload"
      tint="sand"
      title="Import data"
      chevron="right"
      onPress={() => router.push('/import')}
    />
  );
}
