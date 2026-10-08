/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RiskLevel = 'низкий' | 'средний' | 'высокий';

export interface TrapItem {
  пункт: string;
  цитата: string;
  чем_опасно: string;
  уровень: 'средний' | 'высокий';
  что_просить: string;
}

export interface ExtractedNumbers {
  ежемесячный_платёж: number | null;
  процент_штрафа_в_день: number | null;
  лимит_штрафа: string | null;
  залог: number | null;
  срок_уведомления_дней: number | null;
  срок_договора_месяцев: number | null;
}

export interface ImportantDate {
  что: string;
  когда: string;
}

export interface GeminiContractAnalysis {
  тип_договора: string;
  стороны: string[];
  общий_уровень_риска: RiskLevel;
  ловушки: TrapItem[];
  числа: ExtractedNumbers;
  важные_сроки: ImportantDate[];
  вопросы_юристу: string[];
  error?: string | null;
}
