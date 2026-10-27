import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://namsamart:test@localhost:5432/test";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

test("integration credentials encrypt and decrypt with the same key", async () => {
  const { decryptIntegrationSecret, encryptIntegrationSecret } = await import("./integration-secrets.js");
  const key = Buffer.alloc(32, 7);
  const secret = JSON.stringify({ apiKey: "sensitive-provider-key" });
  const encrypted = encryptIntegrationSecret(secret, key);

  assert.notEqual(encrypted, secret);
  assert.equal(decryptIntegrationSecret(encrypted, key), secret);
});

test("integration credentials cannot be decrypted with a different key", async () => {
  const { decryptIntegrationSecret, encryptIntegrationSecret } = await import("./integration-secrets.js");
  const { HttpError } = await import("../lib/errors.js");
  const encrypted = encryptIntegrationSecret("provider-key", Buffer.alloc(32, 7));

  assert.throws(
    () => decryptIntegrationSecret(encrypted, Buffer.alloc(32, 8)),
    (error: unknown) => error instanceof HttpError && error.status === 500
  );
});

test("malformed encrypted integration payloads return a safe error", async () => {
  const { decryptIntegrationSecret } = await import("./integration-secrets.js");
  const { HttpError } = await import("../lib/errors.js");
  assert.throws(
    () => decryptIntegrationSecret("not-an-encrypted-payload", Buffer.alloc(32, 7)),
    (error: unknown) => error instanceof HttpError && error.status === 500
  );
});
