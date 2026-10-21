import type { MerchantAlias } from '@repo/types';
import { merchantKey } from '@/lib/ai/routine';

export function merchantName(
  raw: string | null,
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[],
): string | null {
  const key = merchantKey(raw);
  return (key && aliases.find((alias) => alias.rawKey === key)?.displayName) || raw;
}
