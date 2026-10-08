/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RiskLevel = 'низкий' | 'средний' | 'высокий';

export interface TrapItem {
  пункт: string;
  цитата?: string;
  опасность?: string;
  чем_опасно?: string;
  просить?: string;
  что_просить?: string;
  уровень: 'средний' | 'высокий';
}

export interface ExtractedNumbers {
  платёж?: number | null;
  ежемесячный_платёж?: number | null;
  штраф_в_день_процент?: number | null;
  процент_штрафа_в_день?: number | null;
  залог?: number | null;
  лимит_штрафа?: string | null;
  срок_уведомления_дней?: number | null;
  срок_договора_месяцев?: number | null;
}

export interface ImportantDate {
  что: string;
  когда: string;
}

export type TrapStatus = 'устранена' | 'осталась' | 'изменена';

export interface TrapComparisonItem {
  пункт: string;
  суть?: string;
  статус: TrapStatus;
  почему: string;
}

export interface RecheckProgress {
  устранено: number;
  всего: number;
  процент: number;
}

export interface RecheckData {
  риск: RiskLevel;
  сравнение: TrapComparisonItem[];
  новые_ловушки: TrapItem[];
  числа: ExtractedNumbers;
  прогресс: RecheckProgress;
}

export interface GeminiContractAnalysis {
  риск?: RiskLevel;
  общий_уровень_риска: RiskLevel;
  тип_договора?: string;
  стороны?: string[];
  ловушки: TrapItem[];
  числа: ExtractedNumbers;
  важные_сроки?: ImportantDate[];
  вопросы_юристу?: string[];
  recheckData?: RecheckData | null;
  error?: string | null;
}
