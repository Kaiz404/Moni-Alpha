-- Receipt photos stop being readable by anyone with the link (#72). Both apps read them through
-- signed links (`createSignedUrl`), which `receipts_select_own` grants only for the signed-in user's
-- own `{uid}/` folder. Every installed build signs links since d9e34282.
update storage.buckets set public = false where id = 'receipts';
