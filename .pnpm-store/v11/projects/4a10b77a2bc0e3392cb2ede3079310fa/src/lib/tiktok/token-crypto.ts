import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const TOKEN_ENVELOPE_VERSION = "v1";
const IV_LENGTH = 12;

function encryptionKey(): Buffer {
  const encoded = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new Error("TIKTOK_TOKEN_ENCRYPTION_KEY est manquant.");
  }

  const key = /^[a-f0-9]{64}$/i.test(encoded)
    ? Buffer.from(encoded, "hex")
    : Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error("TIKTOK_TOKEN_ENCRYPTION_KEY doit contenir exactement 32 octets.");
  }

  return key;
}

export function isTikTokTokenEncryptionConfigured(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptTikTokToken(token: string): string {
  if (!token) throw new Error("Impossible de chiffrer un jeton vide.");

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_ENVELOPE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptTikTokToken(envelope: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = envelope.split(".");
  if (
    version !== TOKEN_ENVELOPE_VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue
  ) {
    throw new Error("Format de jeton chiffre invalide.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
