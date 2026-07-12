-- Per-wallet Android notification app linking (one app per wallet; many wallets may share an app).
ALTER TABLE wallets
  ADD COLUMN notification_package TEXT NULL,
  ADD COLUMN notification_app_label TEXT NULL,
  ADD COLUMN notification_account_hint TEXT NULL;

COMMENT ON COLUMN wallets.notification_package IS 'Android package name for notification routing (e.g. com.maybank2u.life)';
COMMENT ON COLUMN wallets.notification_app_label IS 'Display label for the linked banking app';
COMMENT ON COLUMN wallets.notification_account_hint IS 'Optional disambiguator when multiple wallets share the same app';
