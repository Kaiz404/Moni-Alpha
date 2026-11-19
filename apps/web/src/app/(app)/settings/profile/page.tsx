import type { Metadata } from 'next';
import { ProfileSection } from '@/components/settings/profile-section';

export const metadata: Metadata = { title: 'Profile settings | Moni' };

export default function ProfilePage() {
  return <ProfileSection />;
}
