/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Connection, clusterApiUrl } from '@solana/web3.js';
import { calculateFileSha256 } from './solanaWallet';

export interface VerificationSuccess {
  status: 'match';
  fileHash: string;
  recordedHash: string;
  blockTimestamp: string;
  explorerUrl: string;
  fileName: string;
  signature: string;
}

export interface VerificationMismatch {
  status: 'mismatch';
  fileHash: string;
  recordedHash: string;
  blockTimestamp: string;
  explorerUrl: string;
  fileName: string;
  signature: string;
}

export interface VerificationError {
  status: 'error';
  message: string;
  signature?: string;
}

export type VerificationResult = VerificationSuccess | VerificationMismatch | VerificationError;

/**
 * Extracts a Solana transaction signature (base58, typically 80-90 chars) from a URL or raw string.
 */
export function extractSolanaSignature(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: URL like https://explorer.solana.com/tx/<sig>?cluster=devnet
  const urlMatch = trimmed.match(/\/tx\/([1-9A-HJ-NP-Za-km-z]{60,95})/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Pattern 2: Raw base58 signature
  const rawMatch = trimmed.match(/^[1-9A-HJ-NP-Za-km-z]{60,95}$/);
  if (rawMatch) {
    return rawMatch[0];
  }

  return null;
}

/**
 * Helper to decode base58 byte array if needed
 */
function decodeBase58(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const val = ALPHABET.indexOf(c);
    if (val < 0) return new Uint8Array(0);
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] *= 58;
    }
    bytes[0] += val;
    let carry = 0;
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * Parses Memo record from transaction object (parsed instructions, raw data, or log messages)
 * Expected format: "Kelisim v1 | sha256:<hash>"
 */
function findKelisimMemoHash(tx: any): { memoText: string; hash: string } | null {
  const kelisimRegex = /Kelisim\s+v1\s*\|\s*sha256:([a-fA-F0-9]{64})/i;

  // 1. Check parsed instructions
  const instructions = tx.transaction?.message?.instructions || [];
  for (const ix of instructions) {
    // Check ix.parsed (string)
    if (typeof ix.parsed === 'string') {
      const match = ix.parsed.match(kelisimRegex);
      if (match) {
        return { memoText: match[0], hash: match[1].toLowerCase() };
      }
    }

    // Check ix.data (base58 encoded)
    if (typeof ix.data === 'string') {
      try {
        const decoded = new TextDecoder().decode(decodeBase58(ix.data));
        const match = decoded.match(kelisimRegex);
        if (match) {
          return { memoText: match[0], hash: match[1].toLowerCase() };
        }
      } catch {}
    }
  }

  // 2. Check inner instructions
  const innerIxList = tx.meta?.innerInstructions || [];
  for (const inner of innerIxList) {
    for (const ix of inner.instructions || []) {
      if (typeof ix.parsed === 'string') {
        const match = ix.parsed.match(kelisimRegex);
        if (match) {
          return { memoText: match[0], hash: match[1].toLowerCase() };
        }
      }
      if (typeof ix.data === 'string') {
        try {
          const decoded = new TextDecoder().decode(decodeBase58(ix.data));
          const match = decoded.match(kelisimRegex);
          if (match) {
            return { memoText: match[0], hash: match[1].toLowerCase() };
          }
        } catch {}
      }
    }
  }

  // 3. Check log messages
  const logs = tx.meta?.logMessages || [];
  for (const log of logs) {
    if (typeof log === 'string') {
      const match = log.match(kelisimRegex);
      if (match) {
        return { memoText: match[0], hash: match[1].toLowerCase() };
      }
    }
  }

  return null;
}

/**
 * Formats a block Unix timestamp into readable Russian date & time (Almaty time)
 */
function formatBlockTime(blockTimeSeconds?: number | null): string {
  if (!blockTimeSeconds) return 'недавнего блока';
  try {
    const date = new Date(blockTimeSeconds * 1000);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Almaty',
    }).format(date) + ' (Алматы, GMT+5)';
  } catch {
    return 'недавнего блока';
  }
}

/**
 * Verifies document authenticity against Solana devnet:
 * 1. Calculates SHA-256 client-side using crypto.subtle.digest (no file sent anywhere)
 * 2. Fetches transaction from Solana devnet via @solana/web3.js
 * 3. Extracts "Kelisim v1 | sha256:<hash>" Memo text
 * 4. Compares hashes and returns result
 */
export async function verifyDocumentWithoutWallet(
  signatureOrUrl: string,
  file: File
): Promise<VerificationResult> {
  const signature = extractSolanaSignature(signatureOrUrl);

  if (!signature) {
    return {
      status: 'error',
      message: 'Некорректная ссылка или подпись транзакции Solana. Вставьте ссылку на Solana Explorer или 88-значную подпись.',
    };
  }

  // 1. Calculate file SHA-256 client-side
  let fileHash: string;
  try {
    fileHash = await calculateFileSha256(file);
    fileHash = fileHash.toLowerCase();
  } catch (err: any) {
    return {
      status: 'error',
      message: `Не удалось вычислить цифровой отпечаток файла: ${err?.message || 'ошибка чтения'}`,
      signature,
    };
  }

  // 2. Fetch transaction from Solana devnet
  let tx: any = null;
  try {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx) {
      // Retry once with finalized commitment in case of recent confirmation
      tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'finalized',
      });
    }
  } catch (err: any) {
    console.error('Failed to fetch transaction from Solana devnet:', err);
    return {
      status: 'error',
      message: `Ошибка связи с сетью Solana devnet: ${err?.message || 'проверьте интернет-соединение'}.`,
      signature,
    };
  }

  if (!tx) {
    return {
      status: 'error',
      message: 'Транзакция не найдена в сети Solana devnet. Проверьте правильность подписи или ссылки, и убедитесь, что транзакция была отправлена в сеть devnet.',
      signature,
    };
  }

  // 3. Extract Kelisim Memo record
  const memoData = findKelisimMemoHash(tx);
  if (!memoData) {
    return {
      status: 'error',
      message: 'В указанной транзакции не найдена запись Kelisim (ожидалась запись Memo формата «Kelisim v1 | sha256:...»).',
      signature,
    };
  }

  const recordedHash = memoData.hash;
  const blockTimestamp = formatBlockTime(tx.blockTime);
  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

  // 4. Compare hashes
  if (fileHash === recordedHash) {
    return {
      status: 'match',
      fileHash,
      recordedHash,
      blockTimestamp,
      explorerUrl,
      fileName: file.name,
      signature,
    };
  } else {
    return {
      status: 'mismatch',
      fileHash,
      recordedHash,
      blockTimestamp,
      explorerUrl,
      fileName: file.name,
      signature,
    };
  }
}
