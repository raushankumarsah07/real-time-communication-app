const crypto = require('crypto');

// AES-256-GCM: authenticated encryption (detects tampering as well as hiding content)
const key = () => Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encryptBuffer(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]); // [12 iv][16 tag][ciphertext]
}

function decryptBuffer(data) {
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

const encryptText = (text) => encryptBuffer(Buffer.from(text, 'utf8')).toString('base64');

function decryptText(b64) {
  try {
    return decryptBuffer(Buffer.from(b64, 'base64')).toString('utf8');
  } catch {
    return '[message could not be decrypted]';
  }
}

// Hard-to-guess meeting code like "k7m-x4pq-b9r" (~50 bits of randomness)
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
function generateRoomCode() {
  const c = [...crypto.randomBytes(10)].map((b) => ALPHABET[b % ALPHABET.length]);
  return `${c.slice(0, 3).join('')}-${c.slice(3, 7).join('')}-${c.slice(7, 10).join('')}`;
}

module.exports = { encryptBuffer, decryptBuffer, encryptText, decryptText, generateRoomCode };
