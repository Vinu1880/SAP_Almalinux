// lib/backup-crypto.ts - AES-256-GCM encryption + SHA-256 integrity
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY must be set (64 hex characters = 32 bytes). Generate with: openssl rand -hex 32'
    );
  }
  return Buffer.from(key, 'hex');
}

export function encryptBackup(plaintext: string): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBackup(encryptedData: Buffer): string {
  const key = getEncryptionKey();
  if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted data: too short');
  }
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function computeSHA256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function verifySHA256(data: Buffer | string, expectedHash: string): boolean {
  const actualHash = computeSHA256(data);
  try {
    const actualBuf = Buffer.from(actualHash, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}
