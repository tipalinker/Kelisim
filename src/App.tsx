/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Copy, 
  Check, 
  Wallet, 
  FileCheck, 
  RotateCcw, 
  Lock, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  HelpCircle, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Info, 
  Coins, 
  CalendarDays,
  ShieldAlert,
  Bell,
  ExternalLink,
  LogOut,
  RefreshCw,
  Database,
  History
} from 'lucide-react';
import { MOCK_TRAP_ANALYSIS, RiskTrapItem } from './data/contractTrapData';
import { KelisimLogo } from './components/KelisimLogo';
import { 
  getPhantomProvider, 
  formatAddress, 
  getDevnetBalance, 
  calculateFileSha256,
  sendKelisimMemoTransaction,
  parseSolanaError,
  BlockchainRecord
} from './utils/solanaWallet';

interface StampedRecord {
  fileName: string;
  fileSize?: string;
  hash: string;
  timestamp: string;
  network: string;
  status: 'Зафиксирован';
  partyA: string;
  partyB: string;
  explanation: string;
  signature?: string;
  explorerUrl?: string;
}

const DEFAULT_SAMPLE_NAME = 'Договор аренды помещения №12';

// Helper to format bytes
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' байт';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
}

export default function App() {
  // Navigation step: 1 = Upload, 2 = Trap Check, 3 = Stamping
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSampleSelected, setIsSampleSelected] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Step 2: Trap analysis state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisComplete, setAnalysisComplete] = useState<boolean>(false);
  const [expandedTraps, setExpandedTraps] = useState<Record<string, boolean>>({
    'trap-2': true,
    'trap-3': true,
  });
  const [isLetterModalOpen, setIsLetterModalOpen] = useState<boolean>(false);
  const [copiedLetter, setCopiedLetter] = useState<boolean>(false);

  // Step 3: Stamping and blockchain state
  const [isProcessingStamp, setIsProcessingStamp] = useState<boolean>(false);
  const [record, setRecord] = useState<StampedRecord | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [copiedCertificate, setCopiedCertificate] = useState<boolean>(false);
  const [copiedRecordTx, setCopiedRecordTx] = useState<string | null>(null);
  const [tamperMode, setTamperMode] = useState<boolean>(false);

  // Blockchain records history (persisted in localStorage)
  const [blockchainRecords, setBlockchainRecords] = useState<BlockchainRecord[]>(() => {
    try {
      const saved = localStorage.getItem('kelisim_blockchain_records');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);
  const [phantomNotFound, setPhantomNotFound] = useState<boolean>(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save blockchain records to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('kelisim_blockchain_records', JSON.stringify(blockchainRecords));
    } catch (e) {
      console.warn('Failed to save blockchain records to localStorage:', e);
    }
  }, [blockchainRecords]);

  // Document display name
  const currentDocName = selectedFile ? selectedFile.name : (isSampleSelected ? DEFAULT_SAMPLE_NAME : 'Договор не выбран');
  const currentDocSize = selectedFile ? formatFileSize(selectedFile.size) : '';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setIsSampleSelected(false);
      setFileError(null);
      setTxError(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setIsSampleSelected(false);
      setFileError(null);
      setTxError(null);
    }
  };

  // Quick sample contract generation as real File
  const useSampleContract = () => {
    const sampleText = `ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ №12\nг. Актобе, Республика Казахстан\n1. Предмет договора: Аренда нежилого помещения общей площадью 85 кв.м по адресу: г. Актобе, пр. Абилкайыр хана, 42.\n2. Срок аренды: 12 месяцев с даты подписания.\n3. Стороны договора: ИП «Арендодатель» и ТОО «Арендатор».\n`;
    const sampleBlob = new Blob([sampleText], { type: 'application/pdf' });
    const file = new File([sampleBlob], 'Договор аренды помещения №12.pdf', { type: 'application/pdf' });
    setSelectedFile(file);
    setIsSampleSelected(true);
    setFileError(null);
    setTxError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Step 2 trigger with 1.5s analysis animation
  const startTrapCheck = () => {
    if (!selectedFile) {
      setFileError('Сначала загрузите договор');
      return;
    }
    setFileError(null);
    setCurrentStep(2);
    setIsAnalyzing(true);
    setAnalysisComplete(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisComplete(true);
    }, 1500);
  };

  // Toggle single trap card
  const toggleTrap = (id: string) => {
    setExpandedTraps(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Expand / collapse all traps
  const toggleAllTraps = () => {
    const allIds = MOCK_TRAP_ANALYSIS.traps.map(t => t.id);
    const areAllOpen = allIds.every(id => expandedTraps[id]);
    if (areAllOpen) {
      setExpandedTraps({});
    } else {
      const next: Record<string, boolean> = {};
      allIds.forEach(id => {
        next[id] = true;
      });
      setExpandedTraps(next);
    }
  };

  // Connect to Phantom wallet
  const handleConnectWallet = async (): Promise<boolean> => {
    setIsConnectingWallet(true);
    setPhantomNotFound(false);
    setTxError(null);

    try {
      const provider = getPhantomProvider();
      if (!provider) {
        setPhantomNotFound(true);
        setIsConnectingWallet(false);
        return false;
      }

      const resp = await provider.connect();
      const pubKey = resp.publicKey.toString();
      setWalletAddress(pubKey);

      // Fetch devnet balance via @solana/web3.js
      const balance = await getDevnetBalance(pubKey);
      setWalletBalance(balance);
      return true;
    } catch (err: any) {
      console.warn('Phantom connection error/dismissed:', err);
      setTxError(parseSolanaError(err));
      return false;
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      const provider = getPhantomProvider();
      if (provider) {
        await provider.disconnect();
      }
    } catch (err) {
      console.warn('Phantom disconnect error:', err);
    }
    setWalletAddress(null);
    setWalletBalance(null);
    setIsWalletMenuOpen(false);
  };

  const handleRefreshBalance = async () => {
    if (walletAddress) {
      const balance = await getDevnetBalance(walletAddress);
      setWalletBalance(balance);
    }
  };

  // Eager check and event listeners for Phantom
  useEffect(() => {
    const provider = getPhantomProvider();
    if (provider) {
      provider.connect({ onlyIfTrusted: true })
        .then((resp) => {
          const pubKey = resp.publicKey.toString();
          setWalletAddress(pubKey);
          getDevnetBalance(pubKey).then(setWalletBalance);
        })
        .catch(() => {});

      const handleAccountChanged = (publicKey: any) => {
        if (publicKey) {
          const pubKeyStr = publicKey.toString();
          setWalletAddress(pubKeyStr);
          getDevnetBalance(pubKeyStr).then(setWalletBalance);
        } else {
          setWalletAddress(null);
          setWalletBalance(null);
        }
      };

      const handleDisconnect = () => {
        setWalletAddress(null);
        setWalletBalance(null);
      };

      provider.on('accountChanged', handleAccountChanged);
      provider.on('disconnect', handleDisconnect);

      return () => {
        provider.removeListener('accountChanged', handleAccountChanged);
        provider.removeListener('disconnect', handleDisconnect);
      };
    }
  }, []);

  // Step 3: REAL Transaction to Solana Devnet via Phantom
  const handleStamp = async () => {
    setTxError(null);
    setFileError(null);

    // 1. Check if contract file is loaded
    if (!selectedFile) {
      setFileError('Сначала загрузите договор');
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 2. Check if Phantom wallet is connected
    let provider = getPhantomProvider();
    if (!provider) {
      setPhantomNotFound(true);
      setTxError('Откройте приложение в отдельной вкладке с установленным Phantom для отправки транзакции.');
      return;
    }

    if (!provider.publicKey) {
      const connected = await handleConnectWallet();
      if (!connected) {
        setTxError('Для отправки транзакции в Solana devnet необходимо подтвердить подключение кошелька Phantom.');
        return;
      }
      provider = getPhantomProvider();
    }

    if (!provider || !provider.publicKey) {
      setTxError('Кошелёк Phantom не подключён.');
      return;
    }

    setIsProcessingStamp(true);

    try {
      // 3. Compute SHA-256 directly in browser (crypto.subtle.digest) from user's file
      const fileHash = await calculateFileSha256(selectedFile);

      // 4. Send Memo transaction to Solana devnet with user's wallet as fee payer
      // Instruction program: MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
      // Text: Kelisim v1 | sha256:<fileHash> encoded via TextEncoder (no Buffer)
      const { signature, memoText } = await sendKelisimMemoTransaction(provider, fileHash);

      const now = new Date();
      const formattedDate = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Almaty',
      }).format(now) + ' (Алматы, GMT+5)';

      const currentPubkey = provider.publicKey.toString();
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

      // Update devnet balance
      getDevnetBalance(currentPubkey).then(setWalletBalance);

      // Create new blockchain history record
      const newRecord: BlockchainRecord = {
        id: signature,
        signature,
        memoText,
        documentName: selectedFile.name,
        fileHash,
        timestamp: formattedDate,
        explorerUrl,
      };

      setBlockchainRecords(prev => [newRecord, ...prev.filter(r => r.signature !== signature)]);

      // Display result card
      setRecord({
        fileName: selectedFile.name,
        fileSize: formatFileSize(selectedFile.size),
        hash: fileHash,
        timestamp: formattedDate,
        network: 'Solana (devnet)',
        status: 'Зафиксирован',
        partyA: `Сторона А: подтвердила (${formatAddress(currentPubkey)})`,
        partyB: 'Сторона Б: подтвердила',
        explanation: 'Если в документе изменить даже одну запятую, отпечаток не совпадёт',
        signature,
        explorerUrl,
      });

    } catch (err: any) {
      console.error('Solana transaction failed:', err);
      const friendlyMsg = parseSolanaError(err);
      setTxError(friendlyMsg);
    } finally {
      setIsProcessingStamp(false);
    }
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetAll = () => {
    setCurrentStep(1);
    setRecord(null);
    setTamperMode(false);
    setSelectedFile(null);
    setIsSampleSelected(false);
    setIsAnalyzing(false);
    setAnalysisComplete(false);
    setTxError(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#090d10] text-slate-100 flex flex-col justify-between selection:bg-emerald-500/25 selection:text-emerald-300">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 right-0 w-[450px] h-[350px] bg-teal-500/5 blur-[140px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#090d10]/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Logo & Tag */}
          <KelisimLogo 
            onClick={() => setCurrentStep(1)} 
            size="md"
          />

          {/* Connect Wallet Button */}
          <div className="relative">
            {walletAddress ? (
              <div className="flex items-center gap-2">
                {/* Balance in SOL on Devnet via @solana/web3.js */}
                <div 
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium shadow-sm"
                  title="Баланс кошелька в сети Solana Devnet"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{walletBalance ?? '0 SOL'}</span>
                  <span className="text-[10px] text-slate-400 font-sans">devnet</span>
                </div>

                {/* Address Button: First 4 and Last 4 characters */}
                <button
                  type="button"
                  onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-mono font-medium bg-slate-900 hover:bg-slate-800 text-white border border-emerald-500/40 hover:border-emerald-400 transition-all shadow-sm"
                  title="Управление подключенным кошельком Phantom"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{formatAddress(walletAddress)}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isWalletMenuOpen && (
                  <>
                    {/* Click outside overlay */}
                    <div 
                      className="fixed inset-0 z-40 bg-black/20" 
                      onClick={() => setIsWalletMenuOpen(false)} 
                    />

                    {/* Dropdown Card */}
                    <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#0e141a] border border-slate-700/90 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
                      <div className="pb-3 border-b border-slate-800">
                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span className="font-semibold text-slate-300">Phantom Wallet</span>
                          <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Devnet
                          </span>
                        </div>
                        <div className="font-mono text-xs text-white break-all select-all mt-1.5 bg-[#080c0f] p-2 rounded-lg border border-slate-800/80">
                          {walletAddress}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-xs text-emerald-400 font-mono">
                          <span className="text-slate-400 font-sans">Баланс:</span>
                          <span className="font-semibold text-emerald-300 text-sm">{walletBalance ?? '0 SOL'}</span>
                        </div>
                      </div>

                      <div className="pt-2 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(walletAddress);
                            setIsWalletMenuOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Скопировать адрес</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleRefreshBalance();
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Обновить баланс</span>
                        </button>

                        <a
                          href={`https://explorer.solana.com/address/${walletAddress}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Смотреть в Solana Explorer</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleDisconnectWallet}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 flex items-center gap-2 border-t border-slate-800/80 mt-1.5 pt-2 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Отключить кошелёк</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectWallet}
                disabled={isConnectingWallet}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 hover:border-emerald-500/50 transition-all active:scale-95 shadow-sm disabled:opacity-75"
              >
                {isConnectingWallet ? (
                  <>
                    <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Подключение...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>Подключить кошелёк</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Banner if Phantom is not found */}
        {phantomNotFound && (
          <div className="bg-amber-950/40 border-t border-b border-amber-500/30 px-4 py-3 text-xs text-amber-200 animate-in fade-in duration-200">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-medium">
                  Откройте приложение в отдельной вкладке с установленным Phantom
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-300 hover:text-white underline underline-offset-2 flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Открыть в новой вкладке</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPhantomNotFound(false)}
                  className="text-amber-400 hover:text-white p-0.5"
                  title="Закрыть уведомление"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="relative z-0 flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-start">
        
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 mb-3">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Для малого бизнеса и предпринимателей Казахстана</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">
            Kelisim
          </h1>
          <p className="text-base sm:text-lg text-emerald-400/90 font-medium tracking-tight">
            Договор, который нельзя переписать
          </p>
        </div>

        {/* Global Error Banner */}
        {txError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs sm:text-sm text-rose-200 flex items-start justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-rose-300">Сообщение о транзакции</div>
                <div className="mt-0.5 leading-relaxed">{txError}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTxError(null)}
              className="text-rose-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* File Missing Error Banner */}
        {fileError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs sm:text-sm text-amber-200 flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-semibold">{fileError}</span>
            </div>
            <button
              type="button"
              onClick={() => setFileError(null)}
              className="text-amber-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3-Step Indicator Bar */}
        <div className="mb-8 bg-[#0f141a] border border-slate-800/90 rounded-2xl p-2 sm:p-3 shadow-lg">
          <div className="grid grid-cols-3 gap-1 sm:gap-2 text-xs">
            {/* Step 1 button */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex items-center justify-center gap-2 py-2 px-2 rounded-xl transition-all ${
                currentStep === 1
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                currentStep === 1 ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                1
              </span>
              <span className="truncate">Загрузка</span>
            </button>

            {/* Step 2 button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedFile) {
                  setFileError('Сначала загрузите договор');
                  setCurrentStep(1);
                  return;
                }
                if (!analysisComplete && !isAnalyzing) {
                  startTrapCheck();
                } else {
                  setCurrentStep(2);
                }
              }}
              className={`flex items-center justify-center gap-2 py-2 px-2 rounded-xl transition-all ${
                currentStep === 2
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                currentStep === 2 ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                2
              </span>
              <span className="truncate">Проверка на ловушки</span>
            </button>

            {/* Step 3 button */}
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className={`flex items-center justify-center gap-2 py-2 px-2 rounded-xl transition-all ${
                currentStep === 3
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                currentStep === 3 ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                3
              </span>
              <span className="truncate">Фиксация</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* STEP 1: ЗАГРУЗКА ДОГОВОРА                                  */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden transition-all animate-in fade-in duration-300">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
            />

            {/* Drag & drop box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-500/5 scale-[0.99]'
                  : selectedFile
                  ? 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-500/60'
                  : fileError
                  ? 'border-amber-500/60 bg-amber-950/10'
                  : 'border-slate-700/70 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/70'
              }`}
            >
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                  {selectedFile ? (
                    <FileCheck className="w-7 h-7 text-emerald-400" />
                  ) : (
                    <Upload className="w-7 h-7 text-emerald-400" />
                  )}
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-white text-base sm:text-lg break-all">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      Размер: {formatFileSize(selectedFile.size)} · Готов к фиксации
                    </p>
                    <p className="text-xs text-emerald-400 pt-1">
                      Нажмите, чтобы заменить файл
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-semibold text-white text-base">
                      Перетащите файл договора сюда или нажмите для выбора
                    </p>
                    <p className="text-xs text-slate-400">
                      Поддерживаются PDF, DOCX, TXT и сканы документов до 50 МБ
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick sample toggle or actions */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>Быстрый выбор:</span>
                <button
                  type="button"
                  onClick={useSampleContract}
                  className={`px-2.5 py-1 rounded-lg border transition-colors ${
                    isSampleSelected && selectedFile
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Договор аренды №12
                </button>
              </div>

              {selectedFile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setIsSampleSelected(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-slate-400 hover:text-rose-300 underline underline-offset-2"
                >
                  Удалить файл
                </button>
              )}
            </div>

            {/* Action Buttons for Step 1 */}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={startTrapCheck}
                className="w-full relative group overflow-hidden py-3.5 px-6 rounded-xl font-semibold text-sm sm:text-base text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.99] transition-all shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_35px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-5 h-5 text-slate-950" />
                <span>Проверить на ловушки</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedFile) {
                      setFileError('Сначала загрузите договор');
                      return;
                    }
                    setCurrentStep(3);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Или перейти сразу к фиксации договора</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: АНАЛИЗ И РЕЗУЛЬТАТ ПРОВЕРКИ НА ЛОВУШКИ            */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {isAnalyzing ? (
              <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-10 sm:p-14 text-center shadow-xl space-y-6">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-emerald-400">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Анализируем договор...
                  </h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto">
                    Проверяем скрытые штрафы, односторонние условия, дисбаланс прав и спорные формулировки.
                  </p>
                </div>

                <div className="max-w-xs mx-auto space-y-1.5 text-left text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Сканирование структуры пунктов</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Поиск кабальных неустоек и штрафов</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                    <span className="text-slate-200">Подсчёт потенциальных финансовых потерь</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Верхняя карточка с общим выводом */}
                <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
                        <FileText className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Проверенный документ</div>
                        <div className="font-semibold text-white text-sm sm:text-base">
                          {currentDocName}
                        </div>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/25">
                      <AlertCircle className="w-4 h-4" />
                      <span>Уровень риска: Высокий</span>
                    </div>
                  </div>

                  <div className="pt-2 pb-3">
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      {MOCK_TRAP_ANALYSIS.headline}
                    </h2>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-start gap-2 text-xs text-slate-400">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      {MOCK_TRAP_ANALYSIS.disclaimer}
                    </p>
                  </div>
                </div>

                {/* 3. Блок «Сколько это может стоить» */}
                <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                        <Coins className="w-4 h-4 text-emerald-400" />
                        <span>Сколько это может стоить</span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                        {MOCK_TRAP_ANALYSIS.financialLosses.totalEstimated}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 self-start sm:self-center">
                      ({MOCK_TRAP_ANALYSIS.financialLosses.note})
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {MOCK_TRAP_ANALYSIS.financialLosses.breakdown.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <span className="text-slate-400 font-mono text-[11px] mr-1.5">{item.clause}</span>
                          <span className="text-slate-300">{item.title}</span>
                        </div>
                        <span className="font-semibold text-rose-300 shrink-0 ml-1">{item.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Список найденных ловушек */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                      Список выявленных рисков ({MOCK_TRAP_ANALYSIS.traps.length})
                    </h3>
                    <button
                      type="button"
                      onClick={toggleAllTraps}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {Object.keys(expandedTraps).length === MOCK_TRAP_ANALYSIS.traps.length 
                        ? 'Свернуть все' 
                        : 'Развернуть все'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {MOCK_TRAP_ANALYSIS.traps.map((trap) => {
                      const isOpen = !!expandedTraps[trap.id];
                      const isHigh = trap.riskLevel === 'high';

                      return (
                        <div
                          key={trap.id}
                          className="bg-[#0f141a] border border-slate-800 rounded-xl overflow-hidden transition-all duration-200 hover:border-slate-700/80"
                        >
                          <button
                            type="button"
                            onClick={() => toggleTrap(trap.id)}
                            className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-3 focus:outline-none"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {trap.clauseNumber}
                                </span>
                                <span className="font-bold text-white text-sm sm:text-base">
                                  {trap.title}
                                </span>
                              </div>

                              <div>
                                {isHigh ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/25">
                                    Высокий
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25">
                                    Средний
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-slate-400 p-1">
                              {isOpen ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-4 sm:px-5 pb-5 pt-1 space-y-4 border-t border-slate-800/80 animate-in fade-in duration-200 text-xs sm:text-sm">
                              <div>
                                <div className="text-slate-400 text-xs uppercase font-medium mb-1">
                                  Цитата из договора:
                                </div>
                                <div className="p-3 rounded-lg bg-slate-900 border-l-2 border-slate-600 text-slate-300 italic text-xs leading-relaxed font-sans">
                                  {trap.quote}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-400 text-xs uppercase font-medium mb-1">
                                  Чем это опасно простыми словами:
                                </div>
                                <p className="text-slate-200 leading-relaxed">
                                  {trap.dangerExplanation}
                                </p>
                              </div>

                              {trap.calculationTenge && (
                                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
                                  <Coins className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                  <div>
                                    <div className="font-semibold text-white text-xs sm:text-sm">
                                      Расчёт: {trap.calculationTenge.amountText}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                      {trap.calculationTenge.details}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                                <div className="text-emerald-400 text-xs uppercase font-semibold mb-1 flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Что попросить исправить:</span>
                                </div>
                                <p className="text-emerald-200/90 text-xs leading-relaxed">
                                  {trap.recommendation}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Кнопка «Подготовить письмо контрагенту» */}
                <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base">
                      Хотите предложить исправления контрагенту?
                    </h3>
                    <p className="text-xs text-slate-400">
                      Сгенерировано вежливое деловое письмо с перечнем ключевых правок и компромиссных вариантов.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLetterModalOpen(true)}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all active:scale-[0.99]"
                  >
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>Подготовить письмо контрагенту</span>
                  </button>
                </div>

                {/* 5. Блок «Важные сроки» с напоминаниями */}
                <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-2 text-xs uppercase font-semibold text-slate-400 tracking-wider mb-4">
                    <CalendarDays className="w-4 h-4 text-emerald-400" />
                    <span>Важные сроки</span>
                  </div>

                  <div className="space-y-3">
                    {MOCK_TRAP_ANALYSIS.importantDates.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-white">
                            {item.title}
                          </div>
                          <div className="text-xs text-emerald-400">
                            {item.deadlineText}
                          </div>
                        </div>

                        <div className="self-start sm:self-center">
                          <button
                            disabled
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60 cursor-not-allowed opacity-80"
                          >
                            <Bell className="w-3.5 h-3.5 text-slate-500" />
                            <span>Напомнить мне</span>
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              Скоро
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Блок «3 вопроса юристу» */}
                <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-2 text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3">
                    <HelpCircle className="w-4 h-4 text-emerald-400" />
                    <span>3 вопроса юристу</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Если вы решите проконсультироваться с юристом перед подписанием, задайте ему эти точечные вопросы:
                  </p>

                  <div className="space-y-2.5">
                    {MOCK_TRAP_ANALYSIS.questionsForLawyer.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3"
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                          {q}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 7. Внизу кнопка «Перейти к фиксации договора» */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(3);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full relative group overflow-hidden py-4 px-6 rounded-xl font-semibold text-sm sm:text-base text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.99] transition-all shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_35px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4 text-slate-950" />
                    <span>Перейти к фиксации договора</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: ФИКСАЦИЯ ДОГОВОРА (ТРАНЗАКЦИЯ В SOLANA DEVNET)      */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stamping Trigger Card */}
            <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <Database className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Фиксация цифрового отпечатка в блокчейне
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  {selectedFile ? (
                    <>
                      Документ: <span className="text-white font-medium">{selectedFile.name}</span> ({formatFileSize(selectedFile.size)}).
                      В блокчейн Solana devnet будет записан только SHA-256 хеш документа.
                    </>
                  ) : (
                    <span className="text-amber-300 font-medium">
                      Файл договора ещё не выбран. Сначала загрузите документ на Шаге 1.
                    </span>
                  )}
                </p>
              </div>

              {/* Main Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStamp}
                  disabled={isProcessingStamp}
                  className="w-full max-w-md mx-auto relative group overflow-hidden py-3.5 px-6 rounded-xl font-semibold text-sm sm:text-base text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.99] transition-all shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_35px_rgba(16,185,129,0.4)] disabled:opacity-75 disabled:cursor-wait flex items-center justify-center gap-2"
                >
                  {isProcessingStamp ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                      <span>Записываем в блокчейн…</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-slate-950" />
                      <span>Зафиксировать договор</span>
                    </>
                  )}
                </button>
              </div>

              {!selectedFile && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Перейти к загрузке договора</span>
                  </button>
                </div>
              )}
            </div>

            {/* Карточка результата успешной транзакции */}
            {record && (
              <div className="bg-[#0e141a] border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.6)] relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Top Success Banner */}
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-400 text-slate-950 flex items-center justify-center font-bold">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-emerald-300 font-bold text-base">
                        Записано в блокчейн
                      </div>
                      <div className="text-xs text-emerald-400/80">
                        Неизменяемый криптографический отпечаток сохранён в Solana Devnet
                      </div>
                    </div>
                  </div>

                  {record.explorerUrl && (
                    <a
                      href={record.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs sm:text-sm transition-all shadow-sm"
                    >
                      <span>Посмотреть запись</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Structured Details */}
                <div className="space-y-4">
                  {/* Название документа */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-slate-800/50">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Название документа
                    </span>
                    <span className="sm:col-span-2 text-sm sm:text-base font-semibold text-white break-words">
                      {record.fileName}
                    </span>
                  </div>

                  {/* Статус: «Зафиксирован» (зелёная галочка) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-slate-800/50 items-center">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Статус
                    </span>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-sm font-semibold text-emerald-400">
                        {record.status}
                      </span>
                    </div>
                  </div>

                  {/* Цифровой отпечаток (хеш) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-slate-800/50">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider self-start pt-1">
                      Цифровой отпечаток (хеш)
                    </span>
                    <div className="sm:col-span-2">
                      <div className="bg-[#080c0f] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 group hover:border-slate-700 transition-colors">
                        <code className="text-xs sm:text-sm font-mono text-emerald-300/90 break-all leading-relaxed select-all">
                          {record.hash}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(record.hash, setCopiedHash)}
                          className="shrink-0 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs"
                          title="Скопировать отпечаток"
                        >
                          {copiedHash ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 hidden sm:inline">Скопировано</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Копировать</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Вычислен алгоритмом SHA-256 прямо в браузере. В блокчейн передан только хеш.
                      </p>
                    </div>
                  </div>

                  {/* Подпись транзакции */}
                  {record.signature && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-slate-800/50">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider self-start pt-1">
                        Транзакция в сети
                      </span>
                      <div className="sm:col-span-2">
                        <div className="bg-[#080c0f] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-slate-300 truncate">
                            {record.signature}
                          </span>
                          <a
                            href={record.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium shrink-0 flex items-center gap-1"
                          >
                            <span>Explorer</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Дата и время фиксации */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-slate-800/50 items-center">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Дата и время фиксации
                    </span>
                    <div className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-200">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{record.timestamp}</span>
                    </div>
                  </div>

                  {/* Стороны */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-slate-800/50">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider self-start pt-1">
                      Стороны
                    </span>
                    <div className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>{record.partyA}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>{record.partyB}</span>
                      </div>
                    </div>
                  </div>

                  {/* Сеть: «Solana (тестовый режим)» */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-slate-800/50 items-center">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Сеть
                    </span>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                      <span className="text-sm font-medium text-slate-200">
                        Solana (devnet)
                      </span>
                    </div>
                  </div>

                  {/* Пояснение: «Если в документе изменить даже одну запятую, отпечаток не совпадёт» */}
                  <div className="mt-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-200/90 text-sm flex items-start gap-3">
                    <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-emerald-300">
                        {record.explanation}
                      </p>
                      <p className="text-xs text-emerald-400/70">
                        Текст документа надёжно привязан к блокчейну. Если контрагент предоставит отредактированный экземпляр, хеш не совпадёт.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Интерактивная демонстрация неизменяемости */}
                <div className="mt-6 pt-5 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setTamperMode(!tamperMode)}
                    className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Как проверить, что договор не был изменен? (Интерактивная демонстрация)</span>
                    </span>
                    <span className="text-emerald-400 font-medium">
                      {tamperMode ? 'Скрыть' : 'Показать'}
                    </span>
                  </button>

                  {tamperMode && (
                    <div className="mt-3 p-4 rounded-xl bg-[#090d10] border border-slate-800 text-xs space-y-3 animate-in fade-in duration-300">
                      <p className="text-slate-300 font-medium">
                        Сравнение отпечатков при попытке изменить даже 1 знак:
                      </p>

                      <div className="space-y-2">
                        <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold mb-1">
                            <span>Оригинал договора</span>
                            <span>Хеш совпадает ✓</span>
                          </div>
                          <code className="text-[11px] font-mono text-emerald-300 break-all">
                            {record.hash}
                          </code>
                        </div>

                        <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/20">
                          <div className="flex items-center justify-between text-[11px] text-red-400 font-semibold mb-1">
                            <span>Измененная версия (например, замена 450 000 ₸ ➔ 250 000 ₸)</span>
                            <span>Подделка обнаружена ✗</span>
                          </div>
                          <code className="text-[11px] font-mono text-red-300/80 break-all">
                            f810b49c2e018a33d7b8895021a81dc4901ba32efb6241097e324ef09000a187
                          </code>
                        </div>
                      </div>

                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        В суде или досудебном споре в РК достаточно пересчитать хеш файла: если он совпадает с сохраненным в реестре, подлинность текста доказана со 100% математической точностью.
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const cert = `СВИДЕТЕЛЬСТВО ФИКСАЦИИ KELISIM\n` +
                        `Документ: ${record.fileName}\n` +
                        `Статус: ${record.status}\n` +
                        `SHA-256: ${record.hash}\n` +
                        `Транзакция: ${record.signature ?? '—'}\n` +
                        `Дата/Время: ${record.timestamp}\n` +
                        `Сеть: ${record.network}\n` +
                        `Стороны: ${record.partyA}, ${record.partyB}\n` +
                        `Explorer: ${record.explorerUrl ?? '—'}\n` +
                        `Сервис: Kelisim (Казахстан)`;
                      copyToClipboard(cert, setCopiedCertificate);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/60 text-xs font-medium transition-colors flex items-center gap-2"
                  >
                    {copiedCertificate ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Свидетельство скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Скопировать свидетельство фиксации</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Зафиксировать новый договор</span>
                  </button>
                </div>
              </div>
            )}

            {/* СПИСОК ВСЕХ ЗАПИСЕЙ В БЛОКЧЕЙНЕ (HISTORY LIST) */}
            <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    Список всех записей в Solana (devnet)
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Записей: {blockchainRecords.length}
                </span>
              </div>

              {blockchainRecords.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <Database className="w-8 h-8 text-slate-700 mx-auto" />
                  <p>Пока нет записей в блокчейне.</p>
                  <p className="text-[11px] text-slate-400">
                    После нажатия «Зафиксировать договор» здесь появится подтверждённая транзакция со ссылкой на Solana Explorer.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {blockchainRecords.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 hover:border-slate-700 transition-colors text-xs space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-300">
                        <div className="font-semibold text-white flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{item.documentName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>{item.timestamp}</span>
                        </div>
                      </div>

                      {/* Текст Memo инструкции */}
                      <div className="p-2 rounded-lg bg-[#080c0f] border border-slate-800/80 font-mono text-[11px] text-emerald-300/90 break-all select-all flex items-center justify-between gap-2">
                        <span>{item.memoText}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(item.memoText);
                            setCopiedRecordTx(item.id);
                            setTimeout(() => setCopiedRecordTx(null), 2000);
                          }}
                          className="shrink-0 p-1 text-slate-400 hover:text-white"
                          title="Скопировать текст записи"
                        >
                          {copiedRecordTx === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Ссылка на Explorer */}
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-slate-400 font-mono">
                          tx: {formatAddress(item.signature)}
                        </span>
                        <a
                          href={item.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                          <span>Посмотреть запись</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature Highlights / FAQ for Kazakhstan SMB */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0e141a]/60 border border-slate-800/80">
            <div className="text-emerald-400 font-semibold text-sm mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Без юриста</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Выявляйте скрытые невыгодные условия и формулируйте аргументированные правки контрагенту.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0e141a]/60 border border-slate-800/80">
            <div className="text-emerald-400 font-semibold text-sm mb-1 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              <span>Оценка рисков</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Наглядный финансовый расчёт потенциальных штрафов и скрытых сборов до момента подписания.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0e141a]/60 border border-slate-800/80">
            <div className="text-emerald-400 font-semibold text-sm mb-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Неизменяемость</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Запись SHA-256 в Solana гарантирует, что согласованную редакцию невозможно подменить или оспорить.
            </p>
          </div>
        </div>

      </main>

      {/* MODAL: Подготовить письмо контрагенту */}
      {isLetterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e141a] border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Письмо с правками для контрагента
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLetterModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 flex-1 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-400">
                Готовый текст вежливого делового письма. Содержит главные пункты разногласий и компромиссный вариант:
              </p>
              <div className="p-4 rounded-xl bg-[#080c0f] border border-slate-800/90 text-xs sm:text-sm text-slate-200 font-sans whitespace-pre-line leading-relaxed select-all">
                {MOCK_TRAP_ANALYSIS.draftLetter.text}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => copyToClipboard(MOCK_TRAP_ANALYSIS.draftLetter.text, setCopiedLetter)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2"
              >
                {copiedLetter ? (
                  <>
                    <Check className="w-4 h-4 text-slate-950" />
                    <span>Текст скопирован!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Копировать текст</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsLetterModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-[#070a0d] py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <KelisimLogo size="sm" showSubtitle={false} onClick={() => setCurrentStep(1)} />
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">Проверка и фиксация договоров в блокчейне Solana</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>ст. 152 ГК РК</span>
            <span>·</span>
            <span className="text-emerald-400/90 font-mono">SPL Memo Program</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
