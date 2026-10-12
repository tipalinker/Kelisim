/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BusinessProfile {
  role: string;
  maxPenaltyPercent: string;
  maxPenaltyPerDay?: string;
  maxPaymentDays: string;
  minNoticeDays: string;
  minTerminationNoticeDays?: string;
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
    maxPenaltyPercent: '',
    maxPenaltyPerDay: '',
    maxPaymentDays: '',
    minNoticeDays: '',
    minTerminationNoticeDays: '',
    disputeCity: '',
    customRules: '',
  };
}

export const defaultBusinessProfile = getDefaultBusinessProfile();

export function getSavedBusinessProfile(): BusinessProfile {
  if (typeof window === 'undefined') return getDefaultBusinessProfile();
  try {
    const raw = localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const penalty = (parsed.maxPenaltyPercent ?? parsed.maxPenaltyPerDay ?? '').toString();
      const notice = (parsed.minNoticeDays ?? parsed.minTerminationNoticeDays ?? '').toString();
      return {
        role: parsed.role || '',
        maxPenaltyPercent: penalty,
        maxPenaltyPerDay: penalty,
        maxPaymentDays: (parsed.maxPaymentDays ?? '').toString(),
        minNoticeDays: notice,
        minTerminationNoticeDays: notice,
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
    const penalty = (profile.maxPenaltyPercent ?? profile.maxPenaltyPerDay ?? '').toString().trim();
    const notice = (profile.minNoticeDays ?? profile.minTerminationNoticeDays ?? '').toString().trim();
    const sanitized: BusinessProfile = {
      role: (profile.role || '').trim(),
      maxPenaltyPercent: penalty,
      maxPenaltyPerDay: penalty,
      maxPaymentDays: (profile.maxPaymentDays ? String(profile.maxPaymentDays) : '').trim(),
      minNoticeDays: notice,
      minTerminationNoticeDays: notice,
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

export function isBusinessProfileActive(profile?: BusinessProfile | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.role ||
    profile.maxPenaltyPercent ||
    profile.maxPenaltyPerDay ||
    profile.maxPaymentDays ||
    profile.minNoticeDays ||
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
  const penalty = profile.maxPenaltyPercent || profile.maxPenaltyPerDay;
  if (penalty) {
    parts.push(`Макс. неустойка в день: ${penalty}%`);
  }
  if (profile.maxPaymentDays) {
    parts.push(`Макс. срок оплаты: ${profile.maxPaymentDays} дней`);
  }
  const notice = profile.minNoticeDays || profile.minTerminationNoticeDays;
  if (notice) {
    parts.push(`Мин. срок уведомления об отказе: ${notice} дней`);
  }
  if (profile.disputeCity?.trim()) {
    parts.push(`Город для споров: ${profile.disputeCity.trim()}`);
  }
  if (profile.customRules?.trim()) {
    parts.push(`Доп. правила: ${profile.customRules.trim().slice(0, 300)}`);
  }
  return parts.join('. ');
}

export function formatProfileSummary(profile: BusinessProfile, lang: 'en' | 'ru' = 'en'): string {
  const isEn = lang === 'en';
  const parts: string[] = [];
  if (profile.role) parts.push(isEn ? `Role: ${profile.role}` : `Роль: ${profile.role}`);
  const penalty = profile.maxPenaltyPercent || profile.maxPenaltyPerDay;
  if (penalty) parts.push(isEn ? `max penalty: ${penalty}%/day` : `макс. неустойка в день: ${penalty}%`);
  if (profile.maxPaymentDays) parts.push(isEn ? `payment deadline: up to ${profile.maxPaymentDays} days` : `срок оплаты: до ${profile.maxPaymentDays} дн.`);
  const notice = profile.minNoticeDays || profile.minTerminationNoticeDays;
  if (notice) parts.push(isEn ? `notice: from ${notice} days` : `мин. срок уведомления: ${notice} дн.`);
  if (profile.disputeCity) parts.push(isEn ? `court: ${profile.disputeCity}` : `город споров: ${profile.disputeCity}`);
  if (profile.customRules && profile.customRules.trim()) parts.push(isEn ? `custom: ${profile.customRules.trim().slice(0, 300)}` : `доп. правила: ${profile.customRules.trim().slice(0, 300)}`);
  return parts.join(', ');
}
