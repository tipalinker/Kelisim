/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BusinessProfile {
  role: 'арендатор' | 'арендодатель' | 'заказчик' | 'исполнитель' | 'покупатель' | 'поставщик' | '';
  maxPenaltyPerDay: string;
  maxPaymentDays: string;
  minTerminationNoticeDays: string;
  disputeCity: string;
  customRules: string;
}

export interface RuleViolation {
  пункт: string;
  правило: string;
  что_в_договоре: string;
}

const BUSINESS_PROFILE_STORAGE_KEY = 'kelisim_business_profile';

export const BUSINESS_ROLES = [
  'арендатор',
  'арендодатель',
  'заказчик',
  'исполнитель',
  'покупатель',
  'поставщик',
] as const;

export function getDefaultBusinessProfile(): BusinessProfile {
  return {
    role: '',
    maxPenaltyPerDay: '',
    maxPaymentDays: '',
    minTerminationNoticeDays: '',
    disputeCity: '',
    customRules: '',
  };
}

export function getSavedBusinessProfile(): BusinessProfile {
  if (typeof window === 'undefined') return getDefaultBusinessProfile();
  try {
    const raw = localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        role: parsed.role || '',
        maxPenaltyPerDay: parsed.maxPenaltyPerDay || '',
        maxPaymentDays: parsed.maxPaymentDays || '',
        minTerminationNoticeDays: parsed.minTerminationNoticeDays || '',
        disputeCity: parsed.disputeCity || '',
        customRules: (parsed.customRules || '').slice(0, 300),
      };
    }
  } catch (error) {
    console.warn('Ошибка чтения профиля бизнеса из localStorage:', error);
  }
  return getDefaultBusinessProfile();
}

export function saveBusinessProfile(profile: BusinessProfile): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const sanitized: BusinessProfile = {
      role: profile.role || '',
      maxPenaltyPerDay: profile.maxPenaltyPerDay ? String(profile.maxPenaltyPerDay).trim() : '',
      maxPaymentDays: profile.maxPaymentDays ? String(profile.maxPaymentDays).trim() : '',
      minTerminationNoticeDays: profile.minTerminationNoticeDays ? String(profile.minTerminationNoticeDays).trim() : '',
      disputeCity: (profile.disputeCity || '').trim(),
      customRules: (profile.customRules || '').trim().slice(0, 300),
    };
    localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch (error) {
    console.warn('Ошибка сохранения профиля бизнеса в localStorage:', error);
    return false;
  }
}

export function clearBusinessProfile(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(BUSINESS_PROFILE_STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn('Ошибка очистки профиля бизнеса из localStorage:', error);
    return false;
  }
}

export function isBusinessProfileActive(profile: BusinessProfile): boolean {
  return Boolean(
    profile.role ||
    profile.maxPenaltyPerDay ||
    profile.maxPaymentDays ||
    profile.minTerminationNoticeDays ||
    profile.disputeCity?.trim() ||
    profile.customRules?.trim()
  );
}

/**
 * Packs profile into one short single-line string for AI prompt
 */
export function formatBusinessProfileForPrompt(profile: BusinessProfile): string {
  const parts: string[] = [];
  if (profile.role) {
    parts.push(`Роль пользователя: ${profile.role}`);
  }
  if (profile.maxPenaltyPerDay) {
    parts.push(`Макс. неустойка в день: ${profile.maxPenaltyPerDay}%`);
  }
  if (profile.maxPaymentDays) {
    parts.push(`Макс. срок оплаты: ${profile.maxPaymentDays} дней`);
  }
  if (profile.minTerminationNoticeDays) {
    parts.push(`Мин. срок уведомления об отказе: ${profile.minTerminationNoticeDays} дней`);
  }
  if (profile.disputeCity?.trim()) {
    parts.push(`Город для споров: ${profile.disputeCity.trim()}`);
  }
  if (profile.customRules?.trim()) {
    parts.push(`Доп. правила: ${profile.customRules.trim().slice(0, 300)}`);
  }
  return parts.join('. ');
}
