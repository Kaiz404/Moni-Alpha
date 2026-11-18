// Deletes the caller's account: their receipt files, then the auth user, which every table
// cascades from. Safe to retry: each step finds what an earlier, interrupted run left.
import { emptyFolder, type Bucket } from '../_shared/files.ts';
import { adminClient, callerId, fail, json, serve } from '../_shared/http.ts';

serve(async (req) => {
  const admin = adminClient();
  const userId = await callerId(admin, req);
  if (!userId) return fail('Sign in again to delete your account', 401);

  const receipts = admin.storage.from('receipts');
  const bucket: Bucket = {
    async list(folder, limit) {
      const { data, error } = await receipts.list(folder, { limit, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      // Storage lists a subfolder as an entry with no id.
      return data.map((entry) => ({ name: entry.name, folder: entry.id === null }));
    },
    async remove(paths) {
      const { data, error } = await receipts.remove(paths);
      if (error) throw error;
      return data.length;
    },
  };
  await emptyFolder(bucket, userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  // A retry after the user went still reports success.
  if (error && error.status !== 404) throw error;
  return json({ ok: true });
});
