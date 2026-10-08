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
  History,
  FileSearch,
  Calculator
} from 'lucide-react';
import { 
  GeminiContractAnalysis, 
  TrapItem 
} from './data/contractTrapData';
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
  versionLabel?: string;
  originalFileName?: string;
}

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

function validateContractFile(file: File): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase();
  const validExtensions = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
  const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
  const validMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
  ];
  const hasValidMime = validMimes.includes(file.type);

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: 'Неподдерживаемый формат файла. Разрешены только PDF, DOCX, TXT, PNG, JPG (до 4 МБ).',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Файл превышает допустимый размер (до 4 МБ). Текущий размер: ${formatFileSize(file.size)}.`,
    };
  }

  return { valid: true };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' байт';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
}

function formatTenge(amount: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(amount)) + ' ₸';
}

function formatTrapsHeadline(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return `Найдено ${count} условий, на которые стоит обратить внимание`;
  }
  if (mod10 === 1) {
    return `Найдено ${count} условие, на которое стоит обратить внимание`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `Найдено ${count} условия, на которые стоит обратить внимание`;
  }
  return `Найдено ${count} условий, на которые стоит обратить внимание`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsText(file, 'UTF-8');
  });
}

export default function App() {
  // Navigation step: 1 = Upload, 2 = Trap Check, 3 = Stamping
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Step 2: Trap analysis state (ONLY populated by real Gemini response)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<GeminiContractAnalysis | null>(null);
  const [expandedTraps, setExpandedTraps] = useState<Record<number, boolean>>({});

  // Calculation overrides / user inputs for missing contract numbers
  const [customMonthlyPayment, setCustomMonthlyPayment] = useState<string>('');
  const [customPenaltyPercent, setCustomPenaltyPercent] = useState<string>('');
  const [customPenaltyDays, setCustomPenaltyDays] = useState<number>(30);

  // Step 2 Letter generation state
  const [isGeneratingLetter, setIsGeneratingLetter] = useState<boolean>(false);
  const [letterError, setLetterError] = useState<string | null>(null);
  const [letterText, setLetterText] = useState<string>('');
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

  // Contract version tracking
  const [isAgreedVersion, setIsAgreedVersion] = useState<boolean>(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const [originalFileSize, setOriginalFileSize] = useState<number | null>(null);
  const [replacementSource, setReplacementSource] = useState<'manual' | 'rechecked' | null>(null);

  // Agreed upload modal and risk warning modal
  const [isAgreedUploadModalOpen, setIsAgreedUploadModalOpen] = useState<boolean>(false);
  const [stagedAgreedFile, setStagedAgreedFile] = useState<File | null>(null);
  const [agreedFileError, setAgreedFileError] = useState<string | null>(null);
  const [isAgreedDragging, setIsAgreedDragging] = useState<boolean>(false);
  const [isRiskWarningModalOpen, setIsRiskWarningModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const agreedFileInputRef = useRef<HTMLInputElement>(null);

  // Save blockchain records to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('kelisim_blockchain_records', JSON.stringify(blockchainRecords));
    } catch (e) {
      console.warn('Failed to save blockchain records to localStorage:', e);
    }
  }, [blockchainRecords]);

  // Synchronize initial numbers for code-based calculations when analysis arrives
  useEffect(() => {
    if (analysisResult?.числа) {
      if (analysisResult.числа.ежемесячный_платёж != null) {
        setCustomMonthlyPayment(String(analysisResult.числа.ежемесячный_платёж));
      }
      if (analysisResult.числа.процент_штрафа_в_день != null) {
        setCustomPenaltyPercent(String(analysisResult.числа.процент_штрафа_в_день));
      }
    }
  }, [analysisResult]);

  // Validate initial file
  const validateAndSetFile = (file: File) => {
    setFileError(null);
    setAnalysisError(null);
    setAnalysisResult(null);
    setLetterText('');
    setIsAgreedVersion(false);
    setOriginalFileName(null);
    setOriginalFileSize(null);
    setReplacementSource(null);

    const validation = validateContractFile(file);
    if (!validation.valid) {
      setFileError(validation.error || 'Ошибка формата файла.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return false;
    }

    setSelectedFile(file);
    return true;
  };

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
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // Staging for agreed file modal
  const validateAndStageAgreedFile = (file: File) => {
    setAgreedFileError(null);
    const validation = validateContractFile(file);
    if (!validation.valid) {
      setAgreedFileError(validation.error || 'Ошибка формата файла.');
      setStagedAgreedFile(null);
      if (agreedFileInputRef.current) agreedFileInputRef.current.value = '';
      return false;
    }
    setStagedAgreedFile(file);
    return true;
  };

  const handleAgreedDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAgreedDragging(true);
  };

  const handleAgreedDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAgreedDragging(false);
  };

  const handleAgreedDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAgreedDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndStageAgreedFile(e.dataTransfer.files[0]);
    }
  };

  const handleAgreedFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndStageAgreedFile(e.target.files[0]);
    }
  };

  // Step 1 & Step 2: Real AI Trap Check via /api/analyze
  const startTrapCheck = async (targetFile?: File) => {
    const fileToAnalyze = targetFile || selectedFile;
    if (!fileToAnalyze) {
      setFileError('Сначала загрузите договор');
      return;
    }

    setSelectedFile(fileToAnalyze);
    setFileError(null);
    setAnalysisError(null);
    setCurrentStep(2);
    setIsAnalyzing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const isTxt = fileToAnalyze.name.toLowerCase().endsWith('.txt') || fileToAnalyze.type === 'text/plain';
      const fileBase64 = await readFileAsBase64(fileToAnalyze);
      let fileText = '';
      if (isTxt) {
        fileText = await readFileAsText(fileToAnalyze);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'check_traps',
          fileName: fileToAnalyze.name,
          mimeType: fileToAnalyze.type || '',
          fileBase64,
          fileText,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errorMsg = data.error || 'Не удалось проанализировать договор. Попробуйте повторить запрос.';
        setAnalysisError(errorMsg);
        setIsAnalyzing(false);
        return;
      }

      setAnalysisResult(data);
      // Expand first 2 traps by default
      setExpandedTraps({ 0: true, 1: true });
    } catch (err: any) {
      console.error('Trap check error:', err);
      setAnalysisError(err?.message || 'Ошибка связи с сервером анализа. Проверьте интернет-соединение и повторите попытку.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Navigate to stamping with warning protection if risky contract
  const handleProceedToStamping = () => {
    const hasRisks = analysisResult && (
      analysisResult.общий_уровень_риска === 'высокий' ||
      analysisResult.общий_уровень_риска === 'средний' ||
      (analysisResult.ловушки && analysisResult.ловушки.length > 0)
    );

    // If it's an unreplaced original draft and risks are detected, show the warning modal
    if (!isAgreedVersion && hasRisks) {
      setIsRiskWarningModalOpen(true);
    } else {
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Apply agreed replacement file: Scenario A (recheck) or Scenario B (direct stamp)
  const handleApplyAgreedFile = async (scenario: 'recheck' | 'direct_stamp') => {
    if (!stagedAgreedFile) return;

    const prevName = originalFileName || selectedFile?.name || 'Исходный черновик';
    const prevSize = originalFileSize || (selectedFile ? selectedFile.size : 0);

    setOriginalFileName(prevName);
    setOriginalFileSize(prevSize);
    setIsAgreedVersion(true);

    const newDoc = stagedAgreedFile;
    setSelectedFile(newDoc);
    setStagedAgreedFile(null);
    setAgreedFileError(null);
    setIsAgreedUploadModalOpen(false);

    if (scenario === 'recheck') {
      setReplacementSource('rechecked');
      await startTrapCheck(newDoc);
    } else {
      setReplacementSource('manual');
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Step 2: Real Counterpart Letter generation via /api/analyze
  const handleGenerateLetter = async () => {
    if (!analysisResult?.ловушки || analysisResult.ловушки.length === 0) {
      return;
    }

    setIsGeneratingLetter(true);
    setLetterError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_letter',
          contractType: analysisResult.тип_договора,
          parties: analysisResult.стороны,
          traps: analysisResult.ловушки,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setLetterError(data.error || 'Не удалось подготовить письмо. Пожалуйста, повторите.');
        return;
      }

      setLetterText(data.letter || '');
      setIsLetterModalOpen(true);
    } catch (err: any) {
      console.error('Letter generation error:', err);
      setLetterError('Ошибка связи с сервером при подготовке письма. Повторите попытку.');
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  // Toggle single trap card
  const toggleTrap = (index: number) => {
    setExpandedTraps(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Expand / collapse all traps
  const toggleAllTraps = () => {
    if (!analysisResult?.ловушки) return;
    const allCount = analysisResult.ловушки.length;
    const areAllOpen = Object.keys(expandedTraps).length === allCount;
    if (areAllOpen) {
      setExpandedTraps({});
    } else {
      const next: Record<number, boolean> = {};
      for (let i = 0; i < allCount; i++) {
        next[i] = true;
      }
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

  // Step 3: Real Transaction to Solana Devnet via Phantom
  const handleStamp = async () => {
    setTxError(null);
    setFileError(null);

    if (!selectedFile) {
      setFileError('Сначала загрузите договор');
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

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
      const fileHash = await calculateFileSha256(selectedFile);
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

      getDevnetBalance(currentPubkey).then(setWalletBalance);

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

      const detectedParties = analysisResult?.стороны && analysisResult.стороны.length >= 2
        ? `Стороны: ${analysisResult.стороны[0]} и ${analysisResult.стороны[1]}`
        : `Сторона А: подтвердила (${formatAddress(currentPubkey)})`;

      setRecord({
        fileName: selectedFile.name,
        fileSize: formatFileSize(selectedFile.size),
        hash: fileHash,
        timestamp: formattedDate,
        network: 'Solana (devnet)',
        status: 'Зафиксирован',
        partyA: detectedParties,
        partyB: 'Сторона Б: подтвердила',
        explanation: 'Если в документе изменить даже одну запятую, отпечаток не совпадёт',
        signature,
        explorerUrl,
        versionLabel: isAgreedVersion
          ? `Согласованная версия v2 ${replacementSource === 'manual' ? '(заменена вручную)' : '(проверена повторно)'}`
          : 'Исходный черновик',
        originalFileName: isAgreedVersion && originalFileName ? originalFileName : undefined,
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
    setIsAgreedVersion(false);
    setOriginalFileName(null);
    setOriginalFileSize(null);
    setReplacementSource(null);
    setIsAgreedUploadModalOpen(false);
    setIsRiskWarningModalOpen(false);
    setStagedAgreedFile(null);
    setAgreedFileError(null);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setAnalysisError(null);
    setLetterText('');
    setTxError(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (agreedFileInputRef.current) {
      agreedFileInputRef.current.value = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculations in Tenge performed purely by website code
  const numbers = analysisResult?.числа;
  const currentPayment = customMonthlyPayment !== '' ? parseFloat(customMonthlyPayment) : (numbers?.ежемесячный_платёж ?? null);
  const currentPenaltyRate = customPenaltyPercent !== '' ? parseFloat(customPenaltyPercent) : (numbers?.процент_штрафа_в_день ?? null);
  const currentDeposit = numbers?.залог ?? null;
  const currentMonths = numbers?.срок_договора_месяцев ?? null;

  // Scenario 1: Penalty calculation
  const hasPenaltyParams = currentPayment != null && !isNaN(currentPayment) && currentPenaltyRate != null && !isNaN(currentPenaltyRate);
  const calculatedPenalty = hasPenaltyParams ? (currentPenaltyRate / 100) * currentPayment * customPenaltyDays : null;

  // Scenario 3: Total contract obligation calculation
  const hasObligationParams = currentPayment != null && !isNaN(currentPayment) && currentMonths != null && !isNaN(currentMonths);
  const calculatedObligation = hasObligationParams ? currentPayment * currentMonths : null;

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
                {/* Balance in SOL on Devnet */}
                <div 
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium shadow-sm"
                  title="Баланс кошелька в сети Solana Devnet"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{walletBalance ?? '0 SOL'}</span>
                  <span className="text-[10px] text-slate-400 font-sans">devnet</span>
                </div>

                {/* Address Button */}
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
                    <div 
                      className="fixed inset-0 z-40 bg-black/20" 
                      onClick={() => setIsWalletMenuOpen(false)} 
                    />

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

        {/* File Validation Error Banner */}
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
                if (!analysisResult && !isAnalyzing) {
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
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg"
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
                      Размер: {formatFileSize(selectedFile.size)} · Готов к проверке
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
                      Поддерживаются PDF, DOCX, TXT, PNG, JPG до 4 МБ
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Clear file button if selected */}
            {selectedFile && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setAnalysisResult(null);
                    setFileError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-slate-400 hover:text-rose-300 underline underline-offset-2 transition-colors"
                >
                  Удалить файл
                </button>
              </div>
            )}

            {/* Action Buttons for Step 1 */}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => startTrapCheck()}
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
            {/* Loading state: Анализируем договор… */}
            {isAnalyzing && (
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
                    Анализируем договор…
                  </h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto">
                    ИИ читает документ и ищет невыгодные условия, неравные штрафы, автопродление и скрытые платежи.
                  </p>
                </div>

                <div className="max-w-xs mx-auto space-y-2 text-left text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Чтение пунктов и условий договора</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                    <span className="text-slate-200">Поиск юридических и финансовых ловушек</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Формирование простых объяснений и рекомендаций</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error state with retry button */}
            {!isAnalyzing && analysisError && (
              <div className="bg-[#0f141a] border border-rose-500/30 rounded-2xl p-8 text-center shadow-xl space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-white">
                    Не удалось завершить анализ
                  </h3>
                  <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">
                    {analysisError}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => startTrapCheck()}
                    className="px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Повторить</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                  >
                    Выбрать другой файл
                  </button>
                </div>
              </div>
            )}

            {/* If not analyzed yet and no error */}
            {!isAnalyzing && !analysisError && !analysisResult && (
              <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-10 text-center shadow-xl space-y-4">
                <FileSearch className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-lg font-bold text-white">
                  Анализ договора не запущен
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Загрузите договор на Шаге 1 и нажмите кнопку «Проверить на ловушки». Все результаты появятся только из реального анализа вашего документа.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Перейти к загрузке</span>
                </button>
              </div>
            )}

            {/* SUCCESS REAL RESULT FROM GEMINI */}
            {!isAnalyzing && analysisResult && (
              <>
                {/* 1. Верхняя карточка с общим уровнем риска и версией документа */}
                <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                        {isAgreedVersion ? (
                          <FileCheck className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <FileText className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs text-slate-400">Проверенный документ:</span>
                          {/* Индикатор активной версии */}
                          {isAgreedVersion ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Согласованная версия v2 {replacementSource === 'manual' ? '(заменена вручную)' : '(проверена повторно)'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span>Исходный черновик {analysisResult.ловушки.length > 0 ? '(найдены риски)' : '(чисто)'}</span>
                            </span>
                          )}
                        </div>

                        <div className="font-semibold text-white text-sm sm:text-base break-all flex items-center gap-2">
                          <span>{selectedFile ? selectedFile.name : 'Договор'}</span>
                          {selectedFile && (
                            <span className="text-xs text-slate-400 font-normal shrink-0">
                              ({formatFileSize(selectedFile.size)})
                            </span>
                          )}
                        </div>

                        {/* Если это согласованная замена, показываем предыдущий файл с рисками */}
                        {isAgreedVersion && originalFileName && (
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                            <RefreshCw className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>
                              Заменил исходный черновик с рисками: <span className="text-slate-300 font-medium">{originalFileName}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions & Risk Badge: Red for high, Yellow for medium, Green for low */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStagedAgreedFile(null);
                          setAgreedFileError(null);
                          setIsAgreedUploadModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-400/80 transition-all flex items-center gap-1.5 shadow-sm"
                        title="Загрузить согласованную или исправленную версию документа"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Загрузить согласованную версию</span>
                      </button>

                      <div>
                        {analysisResult.общий_уровень_риска === 'высокий' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/25">
                            <AlertCircle className="w-4 h-4" />
                            <span>Уровень риска: Высокий</span>
                          </div>
                        ) : analysisResult.общий_уровень_риска === 'средний' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/25">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Уровень риска: Средний</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Уровень риска: Низкий</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 pb-3">
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      {formatTrapsHeadline(analysisResult.ловушки.length)}
                    </h2>
                    {(analysisResult.тип_договора || (analysisResult.стороны && analysisResult.стороны.length > 0)) && (
                      <p className="text-xs text-slate-400 mt-1">
                        {analysisResult.тип_договора && <span className="text-slate-300 font-medium">Тип: {analysisResult.тип_договора}</span>}
                        {analysisResult.стороны && analysisResult.стороны.length > 0 && (
                          <span className="ml-2">· Стороны: {analysisResult.стороны.join(' и ')}</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-start gap-2 text-xs text-slate-400">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Предварительная проверка, не юридическая консультация. Выявленные пункты рекомендуется обсудить с контрагентом или юристом.
                    </p>
                  </div>
                </div>

                {/* 2. Блок «Расчёты в тенге» (выполняются кодом на сайте по извлечённым числам) */}
                <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                      <Calculator className="w-4 h-4 text-emerald-400" />
                      <span>Расчёты в тенге (по условиям договора)</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Раздельные сценарии с допущениями
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Сценарий 1: Просрочка оплаты и пеня */}
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="font-semibold text-white text-xs mb-1">
                          Сценарий 1: Неустойка (пеня) при задержке оплаты
                        </div>
                        <div className="text-[11px] text-slate-400 mb-2">
                          Допущение: просрочка оплаты на {customPenaltyDays} дней
                        </div>

                        {hasPenaltyParams && calculatedPenalty != null ? (
                          <div className="space-y-1">
                            <div className="font-mono text-emerald-300 text-xs sm:text-sm font-semibold bg-[#090d10] p-2 rounded-lg border border-slate-800 break-words">
                              {currentPenaltyRate}% × {formatTenge(currentPayment!)} × {customPenaltyDays} дн. = {formatTenge(calculatedPenalty)}
                            </div>
                            <div className="text-[11px] text-rose-300">
                              Потенциальная пеня: {formatTenge(calculatedPenalty)}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-amber-300 text-[11px] bg-amber-950/20 p-2 rounded-lg border border-amber-500/20">
                              Не удалось определить: в договоре не найден точный ежемесячный платёж или дневной процент пени.
                            </div>
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[11px] text-slate-400">Введите значения для расчёта:</span>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  placeholder="Платёж, ₸"
                                  value={customMonthlyPayment}
                                  onChange={(e) => setCustomMonthlyPayment(e.target.value)}
                                  className="w-1/2 p-1.5 rounded-lg bg-[#080c0f] border border-slate-700 text-white text-xs font-mono"
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="% в день"
                                  value={customPenaltyPercent}
                                  onChange={(e) => setCustomPenaltyPercent(e.target.value)}
                                  className="w-1/2 p-1.5 rounded-lg bg-[#080c0f] border border-slate-700 text-white text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Сценарий 2: Обеспечительный платёж (залог) */}
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="font-semibold text-white text-xs mb-1">
                          Сценарий 2: Обеспечительный платёж (залог)
                        </div>
                        <div className="text-[11px] text-slate-400 mb-2">
                          Допущение: риск невозврата при досрочном прекращении
                        </div>

                        {currentDeposit != null ? (
                          <div className="space-y-1">
                            <div className="font-mono text-emerald-300 text-xs sm:text-sm font-semibold bg-[#090d10] p-2 rounded-lg border border-slate-800">
                              Залог = {formatTenge(currentDeposit)}
                            </div>
                            <div className="text-[11px] text-slate-300">
                              Сумма обеспечительного платежа, замораживаемая по договору
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[11px] bg-[#090d10] p-2 rounded-lg border border-slate-800">
                            Сумма залога в договоре не зафиксирована (null)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Сценарий 3: Обязательства за весь срок */}
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 sm:col-span-2">
                      <div className="font-semibold text-white text-xs mb-1">
                        Сценарий 3: Базовые обязательства за весь срок действия договора
                      </div>
                      <div className="text-[11px] text-slate-400 mb-2">
                        Допущение: оплата базовой ставки за полный срок без индексаций
                      </div>

                      {hasObligationParams && calculatedObligation != null ? (
                        <div className="font-mono text-emerald-300 text-xs sm:text-sm font-semibold bg-[#090d10] p-2.5 rounded-lg border border-slate-800">
                          {currentMonths} мес. × {formatTenge(currentPayment!)} = {formatTenge(calculatedObligation)}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[11px] bg-[#090d10] p-2 rounded-lg border border-slate-800">
                          Не удалось определить полный объём: {currentMonths == null ? 'срок договора не указан в месяцах' : 'не зафиксирована ежемесячная ставка'}.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Список найденных ловушек */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                      Список выявленных условий ({analysisResult.ловушки.length})
                    </h3>
                    {analysisResult.ловушки.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllTraps}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        {Object.keys(expandedTraps).length === analysisResult.ловушки.length 
                          ? 'Свернуть все' 
                          : 'Развернуть все'}
                      </button>
                    )}
                  </div>

                  {analysisResult.ловушки.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#0f141a] border border-slate-800 text-center text-xs text-slate-400">
                      Критических условий и скрытых ловушек в тексте договора не обнаружено.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analysisResult.ловушки.map((trap: TrapItem, index: number) => {
                        const isOpen = !!expandedTraps[index];
                        const isHigh = trap.уровень === 'высокий';

                        // Check if this trap can show an exact formula in tenge
                        const isPenaltyTrap = trap.чем_опасно?.toLowerCase().includes('пен') || 
                                              trap.чем_опасно?.toLowerCase().includes('штраф') ||
                                              trap.цитата?.toLowerCase().includes('пен') ||
                                              trap.цитата?.toLowerCase().includes('штраф');

                        return (
                          <div
                            key={index}
                            className="bg-[#0f141a] border border-slate-800 rounded-xl overflow-hidden transition-all duration-200 hover:border-slate-700/80"
                          >
                            <button
                              type="button"
                              onClick={() => toggleTrap(index)}
                              className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-3 focus:outline-none"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                    {trap.пункт || `№${index + 1}`}
                                  </span>
                                  <span className="font-bold text-white text-sm sm:text-base">
                                    {trap.чем_опасно ? trap.чем_опасно.slice(0, 70) + (trap.чем_опасно.length > 70 ? '…' : '') : 'Условие договора'}
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
                                {trap.цитата && (
                                  <div>
                                    <div className="text-slate-400 text-xs uppercase font-medium mb-1">
                                      Цитата из договора:
                                    </div>
                                    <div className="p-3 rounded-lg bg-slate-900 border-l-2 border-slate-600 text-slate-300 italic text-xs leading-relaxed font-sans">
                                      «{trap.цитата}»
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <div className="text-slate-400 text-xs uppercase font-medium mb-1">
                                    Чем это опасно простыми словами:
                                  </div>
                                  <p className="text-slate-200 leading-relaxed">
                                    {trap.чем_опасно}
                                  </p>
                                </div>

                                {/* In-card calculation formula if penalty related */}
                                {isPenaltyTrap && hasPenaltyParams && (
                                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
                                    <Coins className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                      <div className="font-semibold text-white text-xs sm:text-sm font-mono">
                                        Формула: {currentPenaltyRate}% × {formatTenge(currentPayment!)} × 30 дней = {formatTenge((currentPenaltyRate! / 100) * currentPayment! * 30)}
                                      </div>
                                      <div className="text-xs text-slate-400 mt-0.5">
                                        Расчёт пени кодом сайта при задержке платежа на 30 календарных дней
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {trap.что_просить && (
                                  <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                                    <div className="text-emerald-400 text-xs uppercase font-semibold mb-1 flex items-center gap-1.5">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Что попросить исправить:</span>
                                    </div>
                                    <p className="text-emerald-200/90 text-xs leading-relaxed">
                                      {trap.что_просить}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Кнопка «Подготовить письмо контрагенту» (ШАГ 2) */}
                <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base">
                      Хотите предложить исправления контрагенту?
                    </h3>
                    <p className="text-xs text-slate-400">
                      ИИ подготовит вежливое деловое письмо с 3–5 ключевыми просьбами и компромиссным вариантом.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateLetter}
                    disabled={isGeneratingLetter}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all active:scale-[0.99] disabled:opacity-75"
                  >
                    {isGeneratingLetter ? (
                      <>
                        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        <span>Готовим письмо контрагенту…</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-emerald-400" />
                        <span>Подготовить письмо контрагенту</span>
                      </>
                    )}
                  </button>
                </div>

                {letterError && (
                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                    <span>{letterError}</span>
                    <button
                      type="button"
                      onClick={handleGenerateLetter}
                      className="underline text-rose-200 font-semibold"
                    >
                      Повторить
                    </button>
                  </div>
                )}

                {/* 5. Блок «Важные сроки» (из ответа модели) */}
                {analysisResult.важные_сроки && analysisResult.важные_сроки.length > 0 && (
                  <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 text-xs uppercase font-semibold text-slate-400 tracking-wider mb-4">
                      <CalendarDays className="w-4 h-4 text-emerald-400" />
                      <span>Важные сроки</span>
                    </div>

                    <div className="space-y-3">
                      {analysisResult.важные_сроки.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-white">
                              {item.что}
                            </div>
                            <div className="text-xs text-emerald-400">
                              {item.когда}
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
                )}

                {/* 6. Блок «3 вопроса юристу» (из ответа модели) */}
                {analysisResult.вопросы_юристу && analysisResult.вопросы_юристу.length > 0 && (
                  <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3">
                      <HelpCircle className="w-4 h-4 text-emerald-400" />
                      <span>Вопросы юристу ({analysisResult.вопросы_юристу.length})</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                      Если вы решите проконсультироваться с юристом перед подписанием, задайте ему эти точечные вопросы по договору:
                    </p>

                    <div className="space-y-2.5">
                      {analysisResult.вопросы_юристу.map((q: string, idx: number) => (
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
                )}

                {/* 7. Внизу блок действий: «Загрузить согласованный документ» и «Перейти к фиксации договора» */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStagedAgreedFile(null);
                      setAgreedFileError(null);
                      setIsAgreedUploadModalOpen(true);
                    }}
                    className="sm:w-1/2 py-3.5 px-5 rounded-xl font-semibold text-xs sm:text-sm bg-[#0e141a] hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-400/80 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Загрузить согласованный документ</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedToStamping}
                    className="sm:w-1/2 relative group overflow-hidden py-3.5 px-6 rounded-xl font-semibold text-xs sm:text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.99] transition-all shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_35px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
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
            <div className="bg-[#0f141a] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <Database className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Фиксация цифрового отпечатка в блокчейне
                </h2>

                {/* Индикатор статуса и версии активного файла на Шаге 3 */}
                {selectedFile && (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {isAgreedVersion ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Согласованная версия v2 (заменена вручную)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        <span>Исходный черновик {analysisResult?.ловушки?.length ? '(найдены риски)' : ''}</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="text-sm text-slate-400 max-w-md mx-auto space-y-1">
                  {selectedFile ? (
                    <>
                      <div>
                        Документ: <span className="text-white font-medium break-all">{selectedFile.name}</span> ({formatFileSize(selectedFile.size)}).
                      </div>
                      {isAgreedVersion && originalFileName && (
                        <div className="text-xs text-emerald-400/90 font-medium flex items-center justify-center gap-1.5">
                          <RefreshCw className="w-3 h-3 text-emerald-400" />
                          <span>Заменил исходный черновик: {originalFileName}</span>
                        </div>
                      )}
                      <div className="text-xs text-slate-400">
                        В блокчейн Solana devnet будет записан только SHA-256 хеш документа.
                      </div>
                    </>
                  ) : (
                    <span className="text-amber-300 font-medium">
                      Файл договора ещё не выбран. Сначала загрузите документ на Шаге 1.
                    </span>
                  )}
                </div>
              </div>

              {/* Кнопка смены версии прямо из Шага 3 */}
              {selectedFile && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStagedAgreedFile(null);
                      setAgreedFileError(null);
                      setIsAgreedUploadModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                  >
                    <Upload className="w-3 h-3 text-emerald-400" />
                    <span>Загрузить другую согласованную версию</span>
                  </button>
                </div>
              )}

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
                      {record.fileName} {record.fileSize ? `(${record.fileSize})` : ''}
                    </span>
                  </div>

                  {/* Версия документа */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-slate-800/50 items-center">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Версия документа
                    </span>
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                      {record.versionLabel?.includes('Согласованная') ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{record.versionLabel}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>Исходный черновик</span>
                        </span>
                      )}
                      {record.originalFileName && (
                        <span className="text-[11px] text-slate-400">
                          (заменил: <span className="text-slate-300 font-mono">{record.originalFileName}</span>)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Статус */}
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

                  {/* Сеть */}
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

                  {/* Пояснение */}
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
                            <span>Измененная версия (изменение одного слова или суммы)</span>
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
                        `Документ: ${record.fileName}${record.fileSize ? ` (${record.fileSize})` : ''}\n` +
                        `Версия: ${record.versionLabel || (isAgreedVersion ? 'Согласованная версия v2' : 'Исходный черновик')}${record.originalFileName ? ` (исходный черновик: ${record.originalFileName})` : ''}\n` +
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
                          <Clock className="w-3.5 h-3.5" />
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
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature Highlights */}
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

      {/* MODAL: Подготовить письмо контрагенту (редактируемый текст) */}
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
                Готовое деловое письмо от ИИ. Вы можете отредактировать текст перед отправкой:
              </p>
              
              <textarea
                value={letterText}
                onChange={(e) => setLetterText(e.target.value)}
                rows={12}
                className="w-full p-4 rounded-xl bg-[#080c0f] border border-slate-800 focus:border-emerald-500/60 focus:outline-none text-xs sm:text-sm text-slate-200 font-sans leading-relaxed resize-y selection:bg-emerald-500/30"
                placeholder="Текст письма..."
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => copyToClipboard(letterText, setCopiedLetter)}
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

      {/* MODAL 1: Предупреждающий баннер / защита от случайной фиксации договора с рисками */}
      {isRiskWarningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e141a] border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative flex flex-col space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Внимание: договор содержит выявленные риски
                  </h3>
                  <div className="mt-1">
                    <span className="inline-block text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {analysisResult?.общий_уровень_риска === 'высокий' ? 'Высокий уровень риска' : 'Средний уровень риска'} · {analysisResult?.ловушки?.length || 0} условий требует внимания
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRiskWarningModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
              <p>
                Вы собираетесь зафиксировать в блокчейне версию, содержащую невыгодные условия или ловушки. Если контрагент уже согласился на правки, сначала загрузите согласованный вариант.
              </p>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-amber-500/20 flex items-center justify-between">
                <span>Текущий файл с ловушками:</span>
                <span className="font-mono text-white font-medium truncate max-w-[220px]">
                  {selectedFile?.name}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsRiskWarningModalOpen(false);
                  setStagedAgreedFile(null);
                  setAgreedFileError(null);
                  setIsAgreedUploadModalOpen(true);
                }}
                className="w-full py-3 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-slate-950" />
                <span>Загрузить исправленную версию</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRiskWarningModalOpen(false);
                  setCurrentStep(3);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/70 text-xs transition-colors flex items-center justify-center gap-2"
                title="Зафиксировать входящий черновик как доказательство разногласий"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Всё равно зафиксировать эту версию (для доказательства разногласий)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Загрузка согласованного документа */}
      {isAgreedUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e141a] border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] flex flex-col space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Загрузить согласованный документ
                  </h3>
                  <p className="text-xs text-slate-400">
                    Замена документа на согласованную редакцию перед фиксацией
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAgreedUploadModalOpen(false);
                  setStagedAgreedFile(null);
                  setAgreedFileError(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-0.5">
              {/* Предыдущий файл с ловушками */}
              <div className="p-3.5 rounded-xl bg-[#090d10] border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">Предыдущая версия (с ловушками):</div>
                    <div className="font-semibold text-slate-200 truncate">
                      {originalFileName || selectedFile?.name || 'Исходный черновик'}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {analysisResult?.ловушки?.length ? `${analysisResult.ловушки.length} ловушек` : 'Риски'}
                </span>
              </div>

              {/* Error banner if file invalid */}
              {agreedFileError && (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                  <span>{agreedFileError}</span>
                  <button
                    type="button"
                    onClick={() => setAgreedFileError(null)}
                    className="text-rose-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Hidden file input */}
              <input
                type="file"
                ref={agreedFileInputRef}
                onChange={handleAgreedFileInputChange}
                className="hidden"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg"
              />

              {/* Dropzone for the new file */}
              {!stagedAgreedFile ? (
                <div
                  onDragOver={handleAgreedDragOver}
                  onDragLeave={handleAgreedDragLeave}
                  onDrop={handleAgreedDrop}
                  onClick={() => agreedFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                    isAgreedDragging
                      ? 'border-emerald-500 bg-emerald-500/10 scale-[0.99]'
                      : 'border-slate-700/80 hover:border-emerald-500/60 bg-slate-900/40 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-white text-sm sm:text-base">
                      Перетащите согласованный с контрагентом документ сюда
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      или нажмите для выбора файла на устройстве
                    </p>
                    <p className="text-[11px] text-emerald-400/80 mt-2">
                      Поддерживаются PDF, DOCX, TXT, PNG, JPG до 4 МБ
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          Выбран новый согласованный файл:
                        </span>
                      </div>
                      <div className="font-semibold text-white text-sm truncate">
                        {stagedAgreedFile.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatFileSize(stagedAgreedFile.size)} · Готов к обработке
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStagedAgreedFile(null);
                      if (agreedFileInputRef.current) agreedFileInputRef.current.value = '';
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors"
                  >
                    Заменить
                  </button>
                </div>
              )}

              {/* 2 Scenario choices once file is chosen */}
              {stagedAgreedFile && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Выберите дальнейшее действие:
                  </div>

                  {/* Вариант А: Быстрая повторная экспресс-проверка */}
                  <button
                    type="button"
                    onClick={() => handleApplyAgreedFile('recheck')}
                    className="w-full text-left p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 transition-all flex items-start gap-3 group shadow-sm active:scale-[0.99]"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs sm:text-sm">
                          Вариант А: Быстрая повторная экспресс-проверка
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Рекомендуется
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                        Перезапустить анализ для нового файла, чтобы убедиться, что контрагент действительно убрал все ловушки.
                      </p>
                    </div>
                  </button>

                  {/* Вариант Б: Перейти сразу к фиксации */}
                  <button
                    type="button"
                    onClick={() => handleApplyAgreedFile('direct_stamp')}
                    className="w-full text-left p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all flex items-start gap-3 group shadow-sm active:scale-[0.99]"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 group-hover:text-emerald-400 transition-colors">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="font-bold text-white text-xs sm:text-sm">
                        Вариант Б: Перейти сразу к фиксации
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                        Обновить текущий файл на новый согласованный и сразу перейти на Шаг 3 (фиксация в Solana Devnet).
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Bottom buttons */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsAgreedUploadModalOpen(false);
                  setStagedAgreedFile(null);
                  setAgreedFileError(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors"
              >
                Отмена
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
            <span className="text-amber-400/80 font-medium">Предварительная проверка, не юридическая консультация</span>
            <span>·</span>
            <span className="text-emerald-400/90 font-mono">SPL Memo Program</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
