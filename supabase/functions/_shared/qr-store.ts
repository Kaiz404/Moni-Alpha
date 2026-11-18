import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.95.3';

import type { QrRequest } from './qr.ts';

const QR_COLUMNS = 'id, code, code_expires_at, expires_at, browser, token_hash';

type QrRow = {
  id: string;
  code: string;
  code_expires_at: string;
  expires_at: string;
  browser: string;
  token_hash: string | null;
};

export type StoredQrRequest = QrRequest & { id: string };

function parse(row: QrRow): StoredQrRequest {
  return {
    id: row.id,
    code: row.code,
    codeExpiresAt: new Date(row.code_expires_at),
    expiresAt: new Date(row.expires_at),
    browser: row.browser,
    tokenHash: row.token_hash,
  };
}

/** The request whose `column` equals `value`, or null. */
export async function findQrRequest(
  admin: SupabaseClient,
  column: 'code' | 'poll_secret_hash',
  value: string,
): Promise<StoredQrRequest | null> {
  const { data, error } = await admin.from('qr_sign_ins').select(QR_COLUMNS).eq(column, value).maybeSingle<QrRow>();
  if (error) throw error;
  return data ? parse(data) : null;
}
