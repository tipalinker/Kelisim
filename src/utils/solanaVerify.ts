/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Connection, clusterApiUrl } from '@solana/web3.js';
import { calculateFileSha256 } from './solanaWallet';

export interface VerificationOutcome {
  status: 'match' | 'mismatch' | 'no_kelisim_memo' | 'not_found' | 'error';
  message: string;
  blockTimestamp?: string;
  explorerUrl?: string;
  fileName?: string;
  fileHash?: string;
  blockchainHash?: string;
  signature?: string;
  rawMemo?: string;
}

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
 * Extracts a clean Solana transaction signature from an Explorer URL or raw signature string.
 */
export function extractSolanaSignature(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Match /tx/<sig> or /txs/<sig> or /transaction/<sig> in Solana Explorer or Solscan URLs
  const urlMatch = trimmed.match(/\/(?:tx|txs|transaction)\/([1-9A-HJ-NP-Za-km-z]{60,95})/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Match URL query parameter e.g. ?tx=<sig>
  const queryMatch = trimmed.match(/[?&]tx=([1-9A-HJ-NP-Za-km-z]{60,95})/i);
  if (queryMatch) {
    return queryMatch[1];
  }

  // If raw base58 signature
  const base58Match = trimmed.match(/^[1-9A-HJ-NP-Za-km-z]{60,95}$/);
  if (base58Match) {
    return base58Match[0];
  }

  // Fallback: strip URL query params / hashes and try extracting base58 substring
  const cleanUrl = trimmed.split('?')[0].split('#')[0];
  const lastSegment = cleanUrl.split('/').filter(Boolean).pop() || '';
  if (/^[1-9A-HJ-NP-Za-km-z]{60,95}$/.test(lastSegment)) {
    return lastSegment;
  }

  return trimmed;
}

const MEMO_REGEX = /Kelisim\s*v1\s*\|\s*sha256:([a-fA-F0-9]{64})/i;

/**
 * Verifies a contract file against a Solana devnet transaction.
 * Completely client-side: computes SHA-256 via Web Crypto API, queries Solana devnet RPC,
 * extracts Memo «Kelisim v1 | sha256:<хеш>», and compares.
 * Zero AI requests, file never leaves the user's browser.
 */
export async function verifyDocumentAgainstSolana(
  signatureOrUrl: string,
  file: File
): Promise<VerificationOutcome> {
  const cleanSignature = extractSolanaSignature(signatureOrUrl);

  if (!cleanSignature) {
    return {
      status: 'error',
      message: 'Укажите ссылку на транзакцию в Solana Explorer или саму подпись транзакции.',
    };
  }

  // Basic signature format validation (base58 characters, typically 64-90 chars)
  if (!/^[1-9A-HJ-NP-za-km-z]{60,95}$/.test(cleanSignature)) {
    return {
      status: 'not_found',
      message: 'Некорректный формат подписи транзакции. Подпись Solana состоит из 64–90 символов Base58.',
      signature: cleanSignature,
    };
  }

  // 1. Calculate SHA-256 hash of the file in the browser
  let fileHash = '';
  try {
    fileHash = await calculateFileSha256(file);
  } catch (err: any) {
    return {
      status: 'error',
      message: `Не удалось вычислить отпечаток файла: ${err?.message || 'ошибка чтения'}`,
    };
  }

  // 2. Fetch transaction from Solana devnet
  let tx: any = null;
  const explorerUrl = `https://explorer.solana.com/tx/${cleanSignature}?cluster=devnet`;

  try {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Attempt getParsedTransaction first
    try {
      tx = await connection.getParsedTransaction(cleanSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    } catch {
      // Fallback to getTransaction
      tx = await connection.getTransaction(cleanSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    }

    if (!tx) {
      // Retry once with finalized commitment in case of recent confirmation
      try {
        tx = await connection.getParsedTransaction(cleanSignature, {
          commitment: 'finalized',
          maxSupportedTransactionVersion: 0,
        });
      } catch {
        tx = await connection.getTransaction(cleanSignature, {
          commitment: 'finalized',
          maxSupportedTransactionVersion: 0,
        });
      }
    }
  } catch (netErr: any) {
    console.error('Failed to fetch transaction from devnet RPC:', netErr);
    return {
      status: 'error',
      message: 'Не удалось связаться с сетью Solana devnet. Проверьте интернет-соединение или повторите попытку через несколько секунд.',
      signature: cleanSignature,
      explorerUrl,
    };
  }

  if (!tx) {
    return {
      status: 'not_found',
      message: 'Транзакция не найдена в сети Solana devnet. Проверьте правильность ссылки или подписи, а также убедитесь, что транзакция была отправлена в сеть devnet.',
      signature: cleanSignature,
      explorerUrl,
    };
  }

  // 3. Extract Memo record: «Kelisim v1 | sha256:<хеш>»
  let blockchainHash: string | null = null;
  let rawMemo: string | null = null;

  // Search source A: logMessages (most reliable in Solana runtime)
  if (tx?.meta?.logMessages && Array.isArray(tx.meta.logMessages)) {
    for (const log of tx.meta.logMessages) {
      const match = log.match(MEMO_REGEX);
      if (match) {
        blockchainHash = match[1].toLowerCase();
        rawMemo = match[0];
        break;
      }
    }
  }

  // Search source B: parsed instructions
  if (!blockchainHash && tx?.transaction?.message?.instructions) {
    for (const ix of tx.transaction.message.instructions) {
      if ('parsed' in ix && typeof ix.parsed === 'string') {
        const match = ix.parsed.match(MEMO_REGEX);
        if (match) {
          blockchainHash = match[1].toLowerCase();
          rawMemo = match[0];
          break;
        }
      }
      if ('data' in ix && typeof ix.data === 'string') {
        try {
          const decoded = new TextDecoder().decode(decodeBase58(ix.data));
          const match = decoded.match(MEMO_REGEX);
          if (match) {
            blockchainHash = match[1].toLowerCase();
            rawMemo = match[0];
            break;
          }
        } catch {}
      }
    }
  }

  // Search source C: inner instructions
  if (!blockchainHash && tx?.meta?.innerInstructions) {
    for (const inner of tx.meta.innerInstructions) {
      for (const ix of inner.instructions || []) {
        if ('parsed' in ix && typeof ix.parsed === 'string') {
          const match = ix.parsed.match(MEMO_REGEX);
          if (match) {
            blockchainHash = match[1].toLowerCase();
            rawMemo = match[0];
            break;
          }
        }
        if ('data' in ix && typeof ix.data === 'string') {
          try {
            const decoded = new TextDecoder().decode(decodeBase58(ix.data));
            const match = decoded.match(MEMO_REGEX);
            if (match) {
              blockchainHash = match[1].toLowerCase();
              rawMemo = match[0];
              break;
            }
          } catch {}
        }
      }
      if (blockchainHash) break;
    }
  }

  // Search source D: serialized JSON representation
  if (!blockchainHash) {
    try {
      const serialized = JSON.stringify(tx);
      const match = serialized.match(MEMO_REGEX);
      if (match) {
        blockchainHash = match[1].toLowerCase();
        rawMemo = match[0];
      }
    } catch {}
  }

  if (!blockchainHash) {
    return {
      status: 'no_kelisim_memo',
      message: 'В транзакции нет записи Kelisim формата «Kelisim v1 | sha256:<хеш>». Убедитесь, что транзакция относится к сервису Kelisim.',
      signature: cleanSignature,
      explorerUrl,
    };
  }

  // 4. Format block timestamp
  let blockTimestamp = 'неизвестно';
  if (tx.blockTime) {
    const dt = new Date(tx.blockTime * 1000);
    blockTimestamp = dt.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  const isMatch = fileHash.toLowerCase() === blockchainHash.toLowerCase();

  if (isMatch) {
    return {
      status: 'match',
      message: `Документ не изменялся. Хеш совпадает с записью в блокчейне от ${blockTimestamp}`,
      blockTimestamp,
      explorerUrl,
      fileName: file.name,
      fileHash,
      blockchainHash,
      signature: cleanSignature,
      rawMemo: rawMemo || `Kelisim v1 | sha256:${blockchainHash}`,
    };
  } else {
    return {
      status: 'mismatch',
      message: 'Документ отличается от зафиксированного',
      blockTimestamp,
      explorerUrl,
      fileName: file.name,
      fileHash,
      blockchainHash,
      signature: cleanSignature,
      rawMemo: rawMemo || `Kelisim v1 | sha256:${blockchainHash}`,
    };
  }
}
