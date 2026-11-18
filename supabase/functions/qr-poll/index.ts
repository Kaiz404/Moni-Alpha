// The web's poll on a QR sign-in. Waiting answers with the current code, rotating it once it lapses;
// approved hands out the magic-link token hash once and deletes the request.
import { adminClient, fail, json, readJson, serve } from '../_shared/http.ts';
import { pollStep, randomToken, sha256Hex } from '../_shared/qr.ts';
import { findQrRequest } from '../_shared/qr-store.ts';

serve(async (req) => {
  const { pollSecret } = await readJson(req);
  if (typeof pollSecret !== 'string' || pollSecret === '') return fail('pollSecret is required', 400);

  const admin = adminClient();
  const secretHash = await sha256Hex(pollSecret);

  // Two tries: a concurrent poll may rotate the code between our read and our write.
  for (let attempt = 0; attempt < 2; attempt++) {
    const now = new Date();
    const request = await findQrRequest(admin, 'poll_secret_hash', secretHash);
    const step = pollStep(request, now);
    switch (step.kind) {
      case 'expired':
        return json({ status: 'expired' });
      case 'waiting':
        return json({ status: 'waiting', code: step.code, codeExpiresAt: step.codeExpiresAt.toISOString() });
      case 'approved': {
        // The delete is the hand-out: of two polls racing here, only one gets the row back.
        const { data, error } = await admin
          .from('qr_sign_ins')
          .delete()
          .eq('poll_secret_hash', secretHash)
          .not('token_hash', 'is', null)
          .select('token_hash');
        if (error) throw error;
        const tokenHash = data[0]?.token_hash;
        return tokenHash ? json({ status: 'approved', tokenHash }) : json({ status: 'expired' });
      }
      case 'rotate': {
        const code = randomToken(16);
        const codeExpiresAt = step.nextCodeExpiresAt;
        const { data, error } = await admin
          .from('qr_sign_ins')
          .update({ code, code_expires_at: codeExpiresAt.toISOString() })
          .eq('poll_secret_hash', secretHash)
          .eq('code', step.staleCode)
          .is('token_hash', null)
          .select('id');
        if (error) throw error;
        if (data.length === 1) return json({ status: 'waiting', code, codeExpiresAt: codeExpiresAt.toISOString() });
        break;
      }
    }
  }
  return fail('The sign-in request changed while polling. Poll again.', 409);
});
