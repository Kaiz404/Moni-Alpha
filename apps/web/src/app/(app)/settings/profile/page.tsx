import type { Metadata } from 'next';
import { ProfileSection } from '@/components/settings/profile-section';

export const metadata: Metadata = { title: 'Profile · Settings · Moni' };

export default function ProfilePage() {
  return <ProfileSection />;
}
