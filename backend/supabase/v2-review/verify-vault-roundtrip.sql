-- Only a nonfunctional fixture is used. No existing secrets are read or changed.
-- The fixture is rolled back; nothing is retained in Vault.
BEGIN;
DO $$
DECLARE fixture_id uuid; fixture_value text := 'NONFUNCTIONAL_VAULT_ENCRYPTION_FIXTURE_2026_10_03';
BEGIN
  fixture_id := vault.create_secret(fixture_value, 'eightbit-verification-rollback-only');
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE id=fixture_id AND secret<>fixture_value) THEN
    RAISE EXCEPTION 'Vault did not store encrypted fixture data';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE id=fixture_id AND decrypted_secret=fixture_value) THEN
    RAISE EXCEPTION 'Vault fixture decryption failed';
  END IF;
END $$;
ROLLBACK;
SELECT jsonb_build_object(
  'encryptionRoundtripVerified',true,
  'fixtureRetained',EXISTS(SELECT 1 FROM vault.secrets WHERE name='eightbit-verification-rollback-only')
) AS vault_verification;
