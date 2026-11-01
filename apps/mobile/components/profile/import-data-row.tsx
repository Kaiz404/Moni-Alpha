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
      meta="From a Moni export or any CSV"
      chevron="right"
      onPress={() => router.push('/import')}
    />
  );
}
