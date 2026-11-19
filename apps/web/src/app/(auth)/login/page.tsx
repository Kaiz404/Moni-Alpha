import type { Metadata } from 'next';
import { LoginView } from '@/components/auth/login-view';
import { safeNextPath } from '@/lib/routes';

export const metadata: Metadata = { title: 'Sign in | Moni' };

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : null);

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  return (
    <LoginView
      initialMode={one(params.mode) === 'create' ? 'createAccount' : 'signIn'}
      next={safeNextPath(one(params.next))}
      initialEmail={one(params.email) ?? ''}
      callbackFailed={one(params.error) === 'auth'}
    />
  );
}
