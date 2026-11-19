import type { Metadata } from 'next';
import { ProfileSection } from '@/components/settings/profile-section';

export const metadata: Metadata = { title: 'Settings · Moni' };

/** Settings opens on Profile beside the nav; on the phone layout it is the list of Profile rows. */
export default function SettingsPage() {
  return <ProfileSection />;
}
