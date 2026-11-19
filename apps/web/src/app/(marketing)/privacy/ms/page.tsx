import { LegalPage, legalMetadata } from '@/components/legal/legal-page';

export const metadata = legalMetadata('privacy', 'ms');

export default function Page() {
  return <LegalPage kind="privacy" lang="ms" />;
}
