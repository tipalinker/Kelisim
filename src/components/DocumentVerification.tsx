/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  FileSearch, 
  Upload, 
  FileCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Clock, 
  FileText, 
  Lock, 
  ShieldCheck,
  ClipboardPaste,
  X
} from 'lucide-react';
import { 
  verifyDocumentAgainstSolana, 
  VerificationOutcome, 
  extractSolanaSignature 
} from '../utils/solanaVerify';
import { BlockchainRecord } from '../utils/solanaWallet';

interface DocumentVerificationProps {
  recentRecords?: BlockchainRecord[];
  onSwitchToAudit?: () => void;
}

export const DocumentVerification: React.FC<DocumentVerificationProps> = () => {
  const [signatureInput, setSignatureInput] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<VerificationOutcome | null>(null);

  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setFileError(null);
    setResult(null);

    // Validate size (up to 4MB)
    if (file.size > 4 * 1024 * 1024) {
      setFileError('Размер файла превышает 4 МБ.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handlePasteSignature = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSignatureInput(text.trim());
      }
    } catch {
      // Clipboard read permission might be denied
    }
  };

  const handleVerify = async () => {
    if (!signatureInput.trim()) {
      setFileError('Введите ссылку на транзакцию или саму подпись.');
      return;
    }
    if (!selectedFile) {
      setFileError('Загрузите файл договора для проверки.');
      return;
    }

    setIsVerifying(true);
    setResult(null);
    setFileError(null);

    try {
      const outcome = await verifyDocumentAgainstSolana(signatureInput, selectedFile);
      setResult(outcome);
    } catch (err: any) {
      console.error('Verification error:', err);
      setResult({
        status: 'error',
        message: err?.message || 'Непредвиденная ошибка при проверке документа.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const cleanSig = extractSolanaSignature(signatureInput);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner explaining wallet-free check */}
      <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Подключение кошелька не требуется</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Проверить подлинность документа
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
            Сравните файл договора с неизменяемой записью в блокчейне Solana devnet.
            Хеш вычисляется исключительно в вашем браузере, файл никуда не отправляется и ИИ не задействуется.
          </p>
        </div>
      </div>

      {/* Main Input Form */}
      <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Field 1: Signature or Solana Explorer URL */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-200">
            Ссылка на транзакцию в Solana Explorer или подпись (signature):
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={signatureInput}
              onChange={(e) => {
                setSignatureInput(e.target.value);
                if (result) setResult(null);
              }}
              placeholder="Вставьте ссылку https://explorer.solana.com/tx/... или подпись транзакции"
              className="w-full pl-3.5 pr-24 py-3 rounded-xl bg-[#080c0f] border border-slate-800 focus:border-emerald-500/60 focus:outline-none text-slate-200 text-xs sm:text-sm font-mono placeholder:text-slate-600 transition-colors"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {signatureInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSignatureInput('');
                    setResult(null);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg"
                  title="Очистить"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handlePasteSignature}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-sans font-medium flex items-center gap-1 transition-colors"
                title="Вставить из буфера обмена"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                <span>Вставить</span>
              </button>
            </div>
          </div>
        </div>

        {/* Field 2: File upload dropzone */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-200">
            Файл договора для сверки:
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/10'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-800 hover:border-emerald-500/40 bg-slate-900/40 hover:bg-slate-900/60'
            }`}
          >
            {selectedFile ? (
              <div className="flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white text-sm break-all">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} КБ · готов к расчёту хеша
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Заменить
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-white text-sm">
                    Перетащите проверяемый файл сюда или нажмите
                  </p>
                  <p className="text-xs text-slate-400">
                    PDF, DOCX, TXT, PNG, JPG (до 4 МБ)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* File Error */}
        {fileError && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{fileError}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Хеш считается только в браузере (crypto.subtle.digest).</span>
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying || !signatureInput.trim() || !selectedFile}
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {isVerifying ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Получаем транзакцию из Solana devnet…</span>
              </>
            ) : (
              <>
                <FileSearch className="w-4 h-4 text-slate-950" />
                <span>Проверить документ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VERIFICATION RESULT CARDS                                 */}
      {/* ========================================================= */}

      {result && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          {/* RESULT 1: MATCH (Зелёная карточка) */}
          {result.status === 'match' && (
            <div className="bg-[#0b1410] border-2 border-emerald-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(16,185,129,0.18)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      Подлинность подтверждена
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Документ не изменялся. Хеш совпадает с записью в блокчейне от {result.blockTimestamp || 'недавно'}
                    </h3>
                  </div>
                </div>

                {result.explorerUrl && (
                  <a
                    href={result.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>Смотреть в Solana Explorer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Verified Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* File Name */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px] mb-1">Имя проверенного файла:</div>
                  <div className="font-semibold text-white break-all flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{result.fileName}</span>
                  </div>
                </div>

                {/* Block timestamp */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px] mb-1">Дата и время блока:</div>
                  <div className="font-semibold text-white flex items-center gap-2 font-mono">
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{result.blockTimestamp}</span>
                  </div>
                </div>
              </div>

              {/* SHA-256 Hash Card */}
              <div className="p-4 rounded-xl bg-[#080c0f] border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400">
                    Совпадающий SHA-256 хеш:
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(result.fileHash || '', 'match_hash')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedHash === 'match_hash' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                </div>
                <code className="text-xs sm:text-sm font-mono text-emerald-300 break-all select-all block leading-relaxed">
                  {result.fileHash}
                </code>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300/90 leading-relaxed">
                ✓ Файл полностью аутентичен. Ни один символ, дата, сумма или пункт не подвергались изменениям с момента фиксации транзакции в devnet.
              </div>
            </div>
          )}

          {/* RESULT 2: MISMATCH (Красная карточка) */}
          {result.status === 'mismatch' && (
            <div className="bg-[#140b0d] border-2 border-rose-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(244,63,94,0.18)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                    <XCircle className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                      Несоответствие
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Документ отличается от зафиксированного
                    </h3>
                  </div>
                </div>

                {result.explorerUrl && (
                  <a
                    href={result.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>Смотреть в Explorer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">
                Цифровой отпечаток загруженного файла не совпадает с хешем, зафиксированным в данной транзакции. 
                Даже добавление одного знака, замена фамилии, даты или суммы кардинально меняет SHA-256.
              </p>

              {/* Side-by-side Hashes */}
              <div className="space-y-3">
                {/* File Hash */}
                <div className="p-3.5 rounded-xl bg-[#080c0f] border border-rose-500/40 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-400">
                      Хеш загруженного файла ({result.fileName}):
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(result.fileHash || '', 'file_hash')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedHash === 'file_hash' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code className="text-xs font-mono text-rose-300 break-all select-all block">
                    {result.fileHash}
                  </code>
                </div>

                {/* Blockchain Hash */}
                <div className="p-3.5 rounded-xl bg-[#080c0f] border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Хеш из записи Memo в блокчейне Solana:
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(result.blockchainHash || '', 'chain_hash')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedHash === 'chain_hash' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code className="text-xs font-mono text-emerald-400 break-all select-all block">
                    {result.blockchainHash}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* RESULT 3: NO KELISIM MEMO OR NOT FOUND */}
          {(result.status === 'no_kelisim_memo' || result.status === 'not_found' || result.status === 'error') && (
            <div className="bg-[#14100b] border-2 border-amber-500/60 rounded-2xl p-6 sm:p-7 shadow-xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">
                    {result.status === 'not_found'
                      ? 'Транзакция не найдена в Solana devnet'
                      : result.status === 'no_kelisim_memo'
                      ? 'В транзакции нет записи Kelisim'
                      : 'Ошибка проверки'}
                  </h3>
                  <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
                    {result.message}
                  </p>
                </div>
              </div>

              {result.explorerUrl && (
                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono truncate max-w-[240px]">
                    {cleanSig}
                  </span>
                  <a
                    href={result.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                  >
                    <span>Проверить в Solana Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Re-verify or check another file button */}
          <div className="pt-3 flex justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Проверить другой документ</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
