/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Connection, 
  PublicKey, 
  clusterApiUrl, 
  LAMPORTS_PER_SOL, 
  Transaction, 
  TransactionInstruction 
} from '@solana/web3.js';

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: {
    toString(): string;
    toBase58(): string;
  };
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: {
      toString(): string;
      toBase58(): string;
    };
  }>;
  disconnect(): Promise<void>;
  signAndSendTransaction(transaction: Transaction): Promise<{ signature: string } | string>;
  on(event: string, callback: (...args: any[]) => void): void;
  removeListener(event: string, callback: (...args: any[]) => void): void;
}

export interface BlockchainRecord {
  id: string;
  signature: string;
  memoText: string;
  documentName: string;
  fileHash: string;
  timestamp: string;
  explorerUrl: string;
}

export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') return null;

  const anyWindow = window as any;

  if (anyWindow.phantom?.solana?.isPhantom) {
    return anyWindow.phantom.solana;
  }

  if (anyWindow.solana?.isPhantom) {
    return anyWindow.solana;
  }

  return null;
}

export function formatAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export async function getDevnetBalance(address: string): Promise<string> {
  try {
    const pubKey = new PublicKey(address);
    // Devnet RPC connection
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const lamports = await connection.getBalance(pubKey);
    const sol = lamports / LAMPORTS_PER_SOL;
    
    if (sol === 0) return '0 SOL';
    if (sol < 0.001) return '<0.001 SOL';
    return `${sol.toFixed(3)} SOL`;
  } catch (error) {
    console.warn('Failed to fetch devnet balance from Solana RPC:', error);
    return '0 SOL';
  }
}

/**
 * Calculates SHA-256 directly in browser using Web Crypto API.
 * The file never leaves the client.
 */
export async function calculateFileSha256(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sends a Memo transaction to Solana devnet using connected Phantom.
 * Uses TextEncoder (no Buffer).
 */
export async function sendKelisimMemoTransaction(
  provider: PhantomProvider,
  fileHash: string
): Promise<{ signature: string; memoText: string }> {
  if (!provider.publicKey) {
    throw new Error('Кошелёк не подключён. Сначала подключите Phantom.');
  }

  const signerPublicKey = new PublicKey(provider.publicKey.toString());
  const memoText = `Kelisim v1 | sha256:${fileHash}`;

  // Use TextEncoder (strictly avoiding Buffer as requested)
  const memoData = new TextEncoder().encode(memoText);

  const memoInstruction = new TransactionInstruction({
    keys: [{ pubkey: signerPublicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: memoData as any,
  });

  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const transaction = new Transaction({
    feePayer: signerPublicKey,
    recentBlockhash: blockhash,
  }).add(memoInstruction);

  // Send transaction via Phantom
  const result = await provider.signAndSendTransaction(transaction);
  const signature = typeof result === 'string' ? result : result.signature;

  if (!signature) {
    throw new Error('Не удалось получить подпись транзакции от Phantom.');
  }

  // Attempt confirmation in background / wait for confirmed commitment
  try {
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );
  } catch (confirmErr) {
    console.warn('Confirmation wait notice:', confirmErr);
    // Even if confirmation polling times out, the tx was broadcast to devnet
  }

  return { signature, memoText };
}

/**
 * Translates errors to clear user-friendly Russian messages
 */
export function parseSolanaError(error: any): string {
  if (!error) return 'Неизвестная ошибка при отправке транзакции.';
  
  const msg = typeof error === 'string' ? error : (error.message || '');
  const code = error.code;

  if (code === 4001 || msg.includes('User rejected') || msg.includes('cancelled') || msg.includes('отклонен')) {
    return 'Транзакция отменена пользователем в кошельке Phantom.';
  }

  if (
    msg.includes('Attempt to debit an account but found no record') || 
    msg.includes('insufficient funds') || 
    msg.includes('0x1') ||
    msg.includes('Insufficient funds')
  ) {
    return 'Недостаточно SOL на кошельке в сети devnet для оплаты комиссии. Получите бесплатные тестовые SOL на solfaucet.com.';
  }

  if (msg.includes('Blockhash not found') || msg.includes('expired')) {
    return 'Время ожидания блока истекло. Пожалуйста, попробуйте отправить ещё раз.';
  }

  if (msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('connection')) {
    return 'Ошибка связи с сетью Solana devnet. Проверьте интернет-соединение или повторите через несколько секунд.';
  }

  return `Ошибка транзакции: ${msg || 'не удалось зафиксировать в блокчейне'}`;
}
