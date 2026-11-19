import { LegalPage, legalMetadata } from '@/components/legal/legal-page';

export const metadata = legalMetadata('terms', 'ms');

export default function Page() {
  return <LegalPage kind="terms" lang="ms" />;
}
