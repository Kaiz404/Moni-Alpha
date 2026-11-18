// The phone's side of a QR sign-in, with the user's access token. `check` names the browser behind a
// scanned code; `approve` mints a magic-link token for the caller and binds it to that request once.
import { adminClient, callerId, fail, json, readJson, serve } from '../_shared/http.ts';
import { approveCheck } from '../_shared/qr.ts';
import { findQrRequest } from '../_shared/qr-store.ts';

const REFUSED = {
  expired: { message: 'This code has expired. Scan the new one.', status: 410 },
  used: { message: 'This code was already used.', status: 409 },
} as const;

serve(async (req) => {
  const { code, step } = await readJson(req);
  if (typeof code !== 'string' || code === '') return fail('code is required', 400);
  if (step !== 'check' && step !== 'approve') return fail("step is 'check' or 'approve'", 400);

  const admin = adminClient();
  const userId = await callerId(admin, req);
  if (!userId) return fail('Sign in on your phone first', 401);

  const check = approveCheck(await findQrRequest(admin, 'code', code), new Date());
  if (!check.ok) return fail(REFUSED[check.reason].message, REFUSED[check.reason].status);
  if (step === 'check') return json({ browser: check.browser });

  const { data: found, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError) throw userError;
  const email = found.user.email;
  if (!email) return fail('This account has no email to sign in with', 422);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkError) throw linkError;

  // The conditions make the approval single use: a second approve, or one after the code lapsed,
  // matches no row.
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('qr_sign_ins')
    .update({ user_id: userId, token_hash: link.properties.hashed_token })
    .eq('code', code)
    .is('token_hash', null)
    .gt('code_expires_at', now)
    .gt('expires_at', now)
    .select('id');
  if (error) throw error;
  if (data.length === 0) return fail(REFUSED.used.message, REFUSED.used.status);
  return json({ ok: true });
});
