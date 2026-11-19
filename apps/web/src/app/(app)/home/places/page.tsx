import type { Metadata } from 'next';
import { PlacesScreen } from '@/components/places/places-screen';

export const metadata: Metadata = { title: 'Where you spend · Moni' };

export default function PlacesPage() {
  return <PlacesScreen />;
}
