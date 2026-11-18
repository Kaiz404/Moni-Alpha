// Starts a QR sign-in for a browser. No sign-in needed; at most STARTS_PER_IP live requests per address.
import { adminClient, fail, json, serve } from '../_shared/http.ts';
import {
  browserLabel,
  clientIp,
  codeExpiry,
  randomToken,
  REQUEST_TTL_MS,
  sha256Hex,
  STARTS_PER_IP,
} from '../_shared/qr.ts';

serve(async (req) => {
  const admin = adminClient();
  const now = new Date();

  // Lapsed requests go first, so the count below sees only live ones.
  const swept = await admin.from('qr_sign_ins').delete().lte('expires_at', now.toISOString());
  if (swept.error) throw swept.error;

  const ipHash = await sha256Hex(clientIp(req.headers.get('X-Forwarded-For')));
  const { count, error: countError } = await admin
    .from('qr_sign_ins')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash);
  if (countError) throw countError;
  if ((count ?? 0) >= STARTS_PER_IP) return fail('Too many sign-in codes. Try again in a few minutes.', 429);

  const pollSecret = randomToken(32);
  const code = randomToken(16);
  const expiresAt = new Date(now.getTime() + REQUEST_TTL_MS);
  const codeExpiresAt = codeExpiry(now, expiresAt);
  const { data, error } = await admin
    .from('qr_sign_ins')
    .insert({
      poll_secret_hash: await sha256Hex(pollSecret),
      code,
      code_expires_at: codeExpiresAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      browser: browserLabel(req.headers.get('User-Agent')),
      ip_hash: ipHash,
    })
    .select('id')
    .single<{ id: string }>();
  if (error) throw error;

  return json({
    requestId: data.id,
    pollSecret,
    code,
    codeExpiresAt: codeExpiresAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
});
