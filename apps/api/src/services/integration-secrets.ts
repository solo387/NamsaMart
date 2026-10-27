import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../lib/config.js";
import { HttpError } from "../lib/errors.js";

const algorithm = "aes-256-gcm";

function getEncryptionKey(value = config.INTEGRATION_SECRETS_KEY) {
  if (!value) {
    throw new HttpError(503, "Integration settings are unavailable. Configure INTEGRATION_SECRETS_KEY for the API.");
  }
  return Buffer.from(value, "hex");
}

export function encryptIntegrationSecret(value: string, key = getEncryptionKey()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(".");
}

export function decryptIntegrationSecret(payload: string, key = getEncryptionKey()) {
  const [ivHex, authTagHex, ciphertextHex, extra] = payload.split(".");
  if (!ivHex || !authTagHex || !ciphertextHex || extra !== undefined) {
    throw new HttpError(500, "Stored integration settings are invalid. Re-enter the provider credentials.");
  }
  try {
    const decipher = createDecipheriv(algorithm, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, "hex")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new HttpError(500, "Stored integration settings could not be decrypted. Verify INTEGRATION_SECRETS_KEY.");
  }
}
