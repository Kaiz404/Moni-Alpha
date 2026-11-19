import type { Metadata } from 'next';
import { AiSection } from '@/components/settings/ai-section';

export const metadata: Metadata = { title: "Moni's AI settings | Moni" };

export default function AiSettingsPage() {
  return <AiSection />;
}
