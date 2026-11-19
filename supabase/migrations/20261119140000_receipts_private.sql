-- Receipt photos stop being readable by anyone with the link (#72). Both apps read them through
-- signed links (`createSignedUrl`), which `receipts_select_own` grants only for the signed-in user's
-- own `{uid}/` folder.
--
-- Push this only after the owner's phone runs a build that signs links. An older build loads the
-- public URL it stored, and every such URL stops working the moment this runs.
update storage.buckets set public = false where id = 'receipts';
