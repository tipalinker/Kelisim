/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { translations as legacyTranslations, formatFileSize, formatTenge, formatDaysGenitive, formatDateTime } from './utils/translations';

export type Language = 'en' | 'ru';

export const LANG_STORAGE_KEY = 'kelisim_lang';

let currentLanguage: Language = 'en';

if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') {
      currentLanguage = saved;
    }
  } catch {
    currentLanguage = 'en';
  }
}

const listeners = new Set<(lang: Language) => void>();

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Failed to persist language:', e);
    }
  }
  listeners.forEach((listener) => {
    try {
      listener(lang);
    } catch (e) {
      console.error(e);
    }
  });
}

export function subscribeLanguage(listener: (lang: Language) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const i18nDictionary = {
  en: {
    ...legacyTranslations.en,
    header: {
      ...legacyTranslations.en.header,
      walletBalanceTooltip: 'Devnet wallet balance on Solana',
      walletManageTooltip: 'Manage connected Phantom wallet',
      phantomWallet: 'Phantom Wallet',
      devnet: 'devnet',
      balance: 'Balance',
      copyAddress: 'Copy address',
      copy: 'Copy',
      copied: 'Copied!',
      refreshBalance: 'Refresh balance',
      viewInExplorer: 'View in Solana Explorer',
      disconnectWallet: 'Disconnect wallet',
      connectWallet: 'Connect Wallet',
      connecting: 'Connecting...',
      wallet: 'Wallet',
      login: 'Log in',
      phantomNotFoundTitle: 'Open app in a new tab with Phantom extension installed',
      openInNewTab: 'Open in new tab',
      closeNotice: 'Close notification',
    },
    hero: {
      badge: 'For small business and entrepreneurs of Kazakhstan',
      title: 'Kelisim',
      tagline: 'Check the contract. Record the version. Prove it.',
    },
    tabs: {
      ...legacyTranslations.en.tabs,
      auditAndStamping: 'Audit & record',
      verifyDocument: 'Verify document',
      noWallet: 'no wallet needed',
      locked: 'Locked',
      stampingInProgress: 'Recording…',
      auditInProgress: 'Audit in progress…',
      protection: 'Protection',
      auditTabTitle: 'Audit and record contract',
      verifyTabTitle: 'Verify document without connecting wallet',
      auditDisabledTooltip: 'Tab unavailable: document verification in progress on Solana. Wait for completion to avoid errors.',
      verifyDisabledStampingTooltip: 'Tab unavailable: file stamping in progress on Solana blockchain. Wait for transaction confirmation.',
      verifyDisabledAuditTooltip: 'Tab unavailable: contract audit in progress. Wait for analysis to complete.',
      stampingRunningBanner: 'Recording file to Solana: tab switching is locked',
      auditRunningBanner: 'Contract audit in progress: tab switching is locked',
      verifyRunningBanner: 'Document verification in progress: tab switching is locked',
      tabBlockedNoticeTitle: 'Tab temporarily unavailable:',
      blockedToVerifyStamping: 'Cannot switch to "Verify document": file stamping in progress on Solana blockchain. Wait for transaction confirmation.',
      blockedToVerifyAudit: 'Cannot switch to "Verify document": contract audit in progress. Wait for analysis to complete to avoid errors.',
      blockedToAuditVerifying: 'Cannot switch to "Audit & record": document verification is currently running in Solana devnet.',
      stepBlockedAudit: 'Step navigation is locked: contract analysis in progress. Please wait.',
      stepBlockedStamping: 'Step navigation is locked: recording transaction is being sent to Solana blockchain.',
      actionLockedNotice: 'Action locked: wait for current operation to finish (audit / stamping / verify).',
    },
    steps: {
      ...legacyTranslations.en.steps,
      step1: 'Upload',
      step2: 'Check for traps',
      step3: 'Record',
      step1Title: 'Step 1: Upload document',
      step2LockedNoFile: 'Attach a contract in Step 1 first',
      step2LockedNoCheck: 'Click "Check for traps" on Step 1 to proceed to audit',
      step2UnlockedTitle: 'Go to audit results',
      step3LockedNoFile: 'Upload a contract in Step 1 first',
      step3LockedNotDone: 'Tab is locked. Upload a file and click "Proceed to record" or finish audit',
      step3UnlockedTitle: 'Go to contract recording',
      blockedAudit: 'Navigation locked: contract analysis in progress',
      blockedStamping: 'Navigation locked: blockchain recording in progress',
    },
    step1: {
      ...legacyTranslations.en.step1,
      toolbarTitle: 'Upload document',
      myRulesBtn: 'My rules',
      myRulesTooltip: 'Configure personal business rules',
      rulesConfiguredTooltip: 'Rules configured',
      dragDropPrompt: 'Drag and drop contract file here',
      clickToBrowse: 'or click to browse from device',
      fileTypes: 'PDF, DOCX, TXT, PNG, JPG up to 4 MB',
      upTo4MB: 'up to 4 MB',
      fileReadyBadge: 'File ready for audit',
      replaceFileBtn: 'Click to replace file',
      removeBtn: 'Remove',
      hintBeforeUpload: 'Upload a contract — choose between instant AI trap check or direct Solana stamping.',
      checkTrapsBtn: 'Check for traps',
      skipAuditBtn: 'Skip audit and proceed directly to recording',
      invalidFormat: 'Unsupported file format. Only PDF, DOCX, TXT, PNG, JPG (up to 4 MB) are allowed.',
      fileTooBig: 'File exceeds 4 MB limit.',
      fileTooBigWithCurrent: 'File exceeds 4 MB limit. Current size: {size}.',
      uploadContractFirst: 'Please upload a contract first',
      fileFormatError: 'File format error.',
      txMessageTitle: 'Transaction message',
    },
    rules: {
      activeTitle: 'Audit will run according to your business rules',
      edit: 'Edit',
      role: 'Role: {role}',
      penaltyUpTo: 'Penalty up to {pct}% per day',
      paymentUpTo: 'Payment up to {days}',
      noticeFrom: 'Notice from {days}',
      court: 'Court: {city}',
      custom: 'Custom rules: {rules}',
    },
    profile: {
      title: 'My rules',
      badge: 'Business profile',
      subtitle: 'Criteria and presets for personalized AI contract audit',
      presetsTitle: 'Rule presets',
      saveCurrentAsPreset: 'Save current as preset',
      presetTitlePlaceholder: 'Preset title (e.g. Warehouse Rent or Client LLC)',
      saveBtn: 'Save',
      cancelBtn: 'Cancel',
      presetsHint: 'Click on any preset to quickly populate parameters.',
      deletePresetTooltip: 'Delete saved preset',
      roleLabel: 'My role',
      roles: {
        tenant: 'tenant',
        landlord: 'landlord',
        client: 'client',
        contractor: 'contractor',
        buyer: 'buyer',
        supplier: 'supplier',
      },
      maxPenaltyLabel: 'Maximum allowable penalty per day (%)',
      maxPenaltyPlaceholder: 'e.g. 0.1',
      maxPenaltyUnit: '% / day',
      maxPenaltyHint: 'Standard market practice in Kazakhstan: 0.05% – 0.1% per day.',
      maxPaymentDaysLabel: 'Maximum payment deadline (days)',
      maxPaymentDaysPlaceholder: 'e.g. 5 or 10',
      minNoticeDaysLabel: 'Minimum notice period for cancellation (days)',
      minNoticeDaysPlaceholder: 'e.g. 30',
      disputeCityLabel: 'City for dispute resolution',
      disputeCityPlaceholder: 'e.g. Almaty or Astana',
      disputeCityHint: 'Alerts if contract specifies another region or remote arbitration.',
      customRulesLabel: 'My custom rules',
      customRulesPlaceholder: 'e.g. No penalty for early termination, acceptance certificate signed within 5 business days',
      clearBtn: 'Clear',
      savedNotice: 'Saved!',
      privacyNote: 'Rules and presets are stored only on your device',
      closeTooltip: 'Close',
    },
    highlights: {
      card1Title: 'Preliminary check without a lawyer',
      card1Desc: 'Uncover hidden one-sided terms and draft grounded proposals to counterparties.',
      card2Title: 'Risk assessment',
      card2Desc: 'Transparent financial calculation of potential penalties and hidden fees before signing.',
      card3Title: 'Immutability',
      card3Desc: 'Proof that the contract has not changed: any edit is immediately revealed by hash mismatch.',
    },
    footer: {
      ...legacyTranslations.en.footer,
      tagline: 'Contract audit and cryptographic stamping on Solana blockchain',
      disclaimer: 'Preliminary check, not legal advice',
      memoProgram: 'SPL Memo Program',
    },
  },
  ru: {
    ...legacyTranslations.ru,
    header: {
      ...legacyTranslations.ru.header,
      walletBalanceTooltip: 'Баланс кошелька в сети Solana Devnet',
      walletManageTooltip: 'Управление подключенным кошельком Phantom',
      phantomWallet: 'Phantom Wallet',
      devnet: 'devnet',
      balance: 'Баланс',
      copyAddress: 'Скопировать адрес',
      copy: 'Копировать',
      copied: 'Скопировано!',
      refreshBalance: 'Обновить баланс',
      viewInExplorer: 'Смотреть в Solana Explorer',
      disconnectWallet: 'Отключить кошелёк',
      connectWallet: 'Кошелёк',
      connecting: 'Подключение...',
      wallet: 'Кошелёк',
      login: 'Вход',
      phantomNotFoundTitle: 'Откройте приложение в отдельной вкладке с установленным Phantom',
      openInNewTab: 'Открыть в новой вкладке',
      closeNotice: 'Закрыть уведомление',
    },
    hero: {
      badge: 'Для малого бизнеса и предпринимателей Казахстана',
      title: 'Kelisim',
      tagline: 'Проверь договор. Зафиксируй версию. Докажи.',
    },
    tabs: {
      ...legacyTranslations.ru.tabs,
      auditAndStamping: 'Аудит и фиксация',
      verifyDocument: 'Проверить документ',
      noWallet: 'кошелёк не нужен',
      locked: 'Заблокировано',
      stampingInProgress: 'Идёт фиксация…',
      auditInProgress: 'Идёт аудит…',
      protection: 'Защита',
      auditTabTitle: 'Аудит и фиксация договора',
      verifyTabTitle: 'Проверить документ без подключения кошелька',
      auditDisabledTooltip: 'Вкладка недоступна: выполняется проверка документа в Solana. Дождитесь завершения во избежание сбоев.',
      verifyDisabledStampingTooltip: 'Вкладка недоступна: выполняется фиксация файла в блокчейне Solana. Дождитесь подтверждения транзакции.',
      verifyDisabledAuditTooltip: 'Вкладка недоступна: выполняется аудит договора. Дождитесь завершения анализа.',
      stampingRunningBanner: 'Идёт фиксация файла в Solana: переключение вкладок заблокировано',
      auditRunningBanner: 'Идёт аудит договора: переключение вкладок заблокировано',
      verifyRunningBanner: 'Идёт проверка документа: переключение вкладок заблокировано',
      tabBlockedNoticeTitle: 'Вход во вкладку временно недоступен:',
      blockedToVerifyStamping: 'Нельзя перейти во вкладку «Проверить документ»: выполняется фиксация файла в блокчейне Solana. Дождитесь подтверждения транзакции.',
      blockedToVerifyAudit: 'Нельзя перейти во вкладку «Проверить документ»: выполняется аудит договора. Дождитесь окончания анализа во избежание сбоев.',
      blockedToAuditVerifying: 'Нельзя перейти во вкладку «Аудит и фиксация»: прямо сейчас выполняется проверка документа в Solana devnet.',
      stepBlockedAudit: 'Переход между шагами заблокирован: выполняется анализ договора. Дождитесь завершения.',
      stepBlockedStamping: 'Переход между шагами заблокирован: транзакция фиксации отправляется в блокчейн Solana.',
      actionLockedNotice: 'Действие заблокировано: дождитесь завершения текущей операции (анализ / фиксация / проверка).',
    },
    steps: {
      ...legacyTranslations.ru.steps,
      step1: 'Загрузка',
      step2: 'Проверка на ловушки',
      step3: 'Фиксация',
      step1Title: 'Шаг 1: Загрузка документа',
      step2LockedNoFile: 'Сначала вложите договор на Шаге 1',
      step2LockedNoCheck: 'Нажмите «Проверить на ловушки» на Шаге 1, чтобы перейти к проверке',
      step2UnlockedTitle: 'Перейти к результатам проверки',
      step3LockedNoFile: 'Сначала загрузите договор на Шаге 1',
      step3LockedNotDone: 'Вкладка заблокирована. Загрузите файл и нажмите «Перейти к фиксации напрямую» или завершите проверку',
      step3UnlockedTitle: 'Перейти к фиксации договора',
      blockedAudit: 'Переход заблокирован: выполняется анализ договора',
      blockedStamping: 'Переход заблокирован: выполняется фиксация в блокчейне',
    },
    step1: {
      ...legacyTranslations.ru.step1,
      toolbarTitle: 'Загрузка документа',
      myRulesBtn: 'Мои правила',
      myRulesTooltip: 'Настроить персональные правила бизнеса',
      rulesConfiguredTooltip: 'Правила настроены',
      dragDropPrompt: 'Перетащите файл договора сюда',
      clickToBrowse: 'или нажмите для выбора на компьютере или смартфоне',
      fileTypes: 'PDF, DOCX, TXT, PNG, JPG до 4 МБ',
      upTo4MB: 'до 4 МБ',
      fileReadyBadge: 'Файл готов к обработке',
      replaceFileBtn: 'Нажмите, чтобы заменить файл',
      removeBtn: 'Удалить',
      hintBeforeUpload: 'Загрузите договор — после загрузки появятся кнопки выбора: экспресс-проверка ИИ или прямая фиксация в Solana.',
      checkTrapsBtn: 'Проверить на ловушки',
      skipAuditBtn: 'Пропустить проверку и перейти к фиксации',
      invalidFormat: 'Неподдерживаемый формат файла. Разрешены только PDF, DOCX, TXT, PNG, JPG (до 4 МБ).',
      fileTooBig: 'Файл превышает допустимый размер (до 4 МБ).',
      fileTooBigWithCurrent: 'Файл превышает допустимый размер (до 4 МБ). Текущий размер: {size}.',
      uploadContractFirst: 'Сначала загрузите договор',
      fileFormatError: 'Ошибка формата файла.',
      txMessageTitle: 'Сообщение о транзакции',
    },
    rules: {
      activeTitle: 'Проверка пойдёт по вашим правилам',
      edit: 'Изменить',
      role: 'Роль: {role}',
      penaltyUpTo: 'Неустойка до {pct}% в день',
      paymentUpTo: 'Оплата до {days}',
      noticeFrom: 'Уведомление от {days}',
      court: 'Суд: {city}',
      custom: 'Доп. правила: {rules}',
    },
    profile: {
      title: 'Мои правила',
      badge: 'Профиль бизнеса',
      subtitle: 'Критерии и пресеты для персональной проверки договоров ИИ',
      presetsTitle: 'Пресеты правил',
      saveCurrentAsPreset: 'Сохранить текущие как пресет',
      presetTitlePlaceholder: 'Название пресета (например: Аренда склада или Клиент ТОО)',
      saveBtn: 'Сохранить',
      cancelBtn: 'Отмена',
      presetsHint: 'Нажмите на любой пресет, чтобы мгновенно подставить параметры.',
      deletePresetTooltip: 'Удалить сохранённый пресет',
      roleLabel: 'Моя роль',
      roles: {
        tenant: 'арендатор',
        landlord: 'арендодатель',
        client: 'заказчик',
        contractor: 'исполнитель',
        buyer: 'покупатель',
        supplier: 'поставщик',
      },
      maxPenaltyLabel: 'Максимальная допустимая неустойка в день (%)',
      maxPenaltyPlaceholder: 'например: 0.1',
      maxPenaltyUnit: '% / день',
      maxPenaltyHint: 'Обычная рыночная практика в Казахстане: 0.05% – 0.1% в день.',
      maxPaymentDaysLabel: 'Максимальный срок оплаты (дней)',
      maxPaymentDaysPlaceholder: 'например: 5 или 10',
      minNoticeDaysLabel: 'Минимальный срок уведомления об отказе от договора (дней)',
      minNoticeDaysPlaceholder: 'например: 30',
      disputeCityLabel: 'Город для рассмотрения споров',
      disputeCityPlaceholder: 'например: Алматы или Астана',
      disputeCityHint: 'Предупредит, если в договоре указан другой регион или удалённый третейский суд.',
      customRulesLabel: 'Мои дополнительные правила',
      customRulesPlaceholder: 'например: Без штрафов за досрочное расторжение, акт приёмки подписывается не менее 5 рабочих дней',
      clearBtn: 'Очистить',
      savedNotice: 'Сохранено!',
      privacyNote: 'Правила и пресеты хранятся только на вашем устройстве',
      closeTooltip: 'Закрыть',
    },
    highlights: {
      card1Title: 'Первая проверка без юриста',
      card1Desc: 'Выявляйте скрытые невыгодные условия и формулируйте аргументированные правки контрагенту.',
      card2Title: 'Оценка рисков',
      card2Desc: 'Наглядный финансовый расчёт потенциальных штрафов и скрытых сборов до момента подписания.',
      card3Title: 'Неизменяемость',
      card3Desc: 'Запись позволяет доказать, что документ не менялся: любая правка видна по несовпадению хеша.',
    },
    footer: {
      ...legacyTranslations.ru.footer,
      tagline: 'Проверка и фиксация договоров в блокчейне Solana',
      disclaimer: 'Предварительная проверка, не юридическая консультация',
      memoProgram: 'SPL Memo Program',
    },
  },
};

function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (path in obj) return obj[path];
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

export function translate(
  key: string,
  params?: Record<string, string | number>,
  langOverride?: Language
): string {
  const lang = langOverride || currentLanguage;
  const currentDict = (i18nDictionary as any)[lang] || i18nDictionary.en;
  const fallbackDict = (i18nDictionary as any).ru || i18nDictionary.en;

  let val = getNestedValue(currentDict, key);
  if (val === undefined) {
    val = getNestedValue(fallbackDict, key);
  }

  if (val === undefined) {
    return key;
  }

  if (typeof val === 'function') {
    if (params && typeof params === 'object') {
      const firstVal = (params as any).addr ?? Object.values(params)[0];
      return val(firstVal);
    }
    return val(params);
  }

  if (typeof val === 'string') {
    if (params) {
      return Object.entries(params).reduce((str, [k, v]) => {
        return str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }, val);
    }
    return val;
  }

  return String(val);
}

// Support role translation for active rules and badges
export function formatRole(role: string, lang: Language = getLanguage()): string {
  if (!role) return '';
  const lower = role.trim().toLowerCase();
  const mapping: Record<string, { en: string; ru: string }> = {
    арендатор: { en: 'tenant', ru: 'арендатор' },
    tenant: { en: 'tenant', ru: 'арендатор' },
    арендодатель: { en: 'landlord', ru: 'арендодатель' },
    landlord: { en: 'landlord', ru: 'арендодатель' },
    заказчик: { en: 'client', ru: 'заказчик' },
    client: { en: 'client', ru: 'заказчик' },
    исполнитель: { en: 'contractor', ru: 'исполнитель' },
    contractor: { en: 'contractor', ru: 'исполнитель' },
    покупатель: { en: 'buyer', ru: 'покупатель' },
    buyer: { en: 'buyer', ru: 'покупатель' },
    поставщик: { en: 'supplier', ru: 'поставщик' },
    supplier: { en: 'supplier', ru: 'поставщик' },
  };

  if (mapping[lower]) {
    return mapping[lower][lang];
  }
  return role;
}

// Proxied callable function t(key, params, lang) that also allows t.header.walletBalanceTooltip
export interface TFunction {
  (key: string, params?: Record<string, string | number>, langOverride?: Language): string;
  [key: string]: any;
}

function createTProxy(path: string[] = []): any {
  const fn = function (keyOrArg?: any, params?: Record<string, string | number>, langOverride?: Language) {
    if (path.length > 0) {
      const currentDict = (i18nDictionary as any)[currentLanguage] || i18nDictionary.en;
      const directTarget = getNestedValue(currentDict, path.join('.'));
      if (typeof directTarget === 'function') {
        const arg = typeof keyOrArg === 'object' && keyOrArg ? (keyOrArg.addr ?? Object.values(keyOrArg)[0]) : keyOrArg;
        return directTarget(arg);
      }
    }
    if (keyOrArg === undefined) {
      return translate(path.join('.'), params, langOverride);
    }
    if (typeof keyOrArg === 'object') {
      return translate(path.join('.'), keyOrArg, params as any);
    }
    const fullKey = path.length > 0 ? `${path.join('.')}.${keyOrArg}` : keyOrArg;
    return translate(fullKey, params, langOverride);
  };

  return new Proxy(fn, {
    get(target, prop, receiver) {
      if (typeof prop === 'string') {
        if (prop in target) {
          return (target as any)[prop];
        }
        const currentLangDict = (i18nDictionary as any)[currentLanguage] || i18nDictionary.en;
        const currentPath = [...path, prop].join('.');
        const directVal = getNestedValue(currentLangDict, currentPath);

        if (typeof directVal === 'function') {
          return (arg: any) => {
            const actualArg = typeof arg === 'object' && arg ? (arg.addr ?? Object.values(arg)[0]) : arg;
            return directVal(actualArg);
          };
        }

        if (directVal !== undefined && typeof directVal !== 'object') {
          return directVal;
        }

        return createTProxy([...path, prop]);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export const t: TFunction = createTProxy();

export { formatFileSize, formatTenge, formatDaysGenitive, formatDateTime };
