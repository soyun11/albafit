-- Add unique constraint on token_hash so lookups can use an index instead of a full table scan.
-- Tables are brand new and empty, so this is safe to apply directly.
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
