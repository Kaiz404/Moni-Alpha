-- Receipt images for proposed_transactions (mobile offline-first upload queue).
-- Without this bucket, the app logs "Bucket not found" when draining the image upload queue.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  true,
  52428800, -- 50 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {userId}/{proposalId}.{ext} — first segment must match auth.uid()
drop policy if exists "receipts_select_own" on storage.objects;
drop policy if exists "receipts_insert_own" on storage.objects;
drop policy if exists "receipts_update_own" on storage.objects;
drop policy if exists "receipts_delete_own" on storage.objects;

create policy "receipts_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "receipts_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "receipts_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "receipts_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and split_part(name, '/', 1) = auth.uid()::text
);
