import type { Metadata } from 'next';
import { ImportSection } from '@/components/settings/import-section';

export const metadata: Metadata = { title: 'Import and export | Moni' };

export default function ImportSettingsPage() {
  return <ImportSection />;
}
