/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// 1. Primary check system instruction (exact user instruction)
const SYSTEM_INSTRUCTION_PRIMARY = `Ты проверяешь договор для предпринимателя в Казахстане. Найди не более 5 самых опасных для подписывающего условий: автопродление, неравные штрафы или сроки, одностороннее изменение цены, скрытые платежи, невозврат залога, расходы без документов, неудобная подсудность, противоречия в суммах. Только то, что реально есть в тексте. Цитата не длиннее 15 слов. Числа бери дословно, если нет, то null. Без процентов безопасности и юридических заключений. Отвечай только JSON на русском: {"риск":"низкий|средний|высокий","ловушки":[{"пункт":"","цитата":"","опасность":"до 20 слов","просить":"до 15 слов","уровень":"средний|высокий"}],"числа":{"платёж":null,"штраф_в_день_процент":null,"залог":null}}`;

// 2. Recheck system instruction (exact user instruction)
const SYSTEM_INSTRUCTION_RECHECK = `Сравни новую версию договора со списком ранее найденных ловушек. Для каждой укажи статус: «устранена», «осталась» или «изменена» (одна короткая фраза почему). Затем добавь не более 3 новых опасных условий, которых не было в списке. Только то, что есть в тексте. Отвечай только JSON на русском: {"риск":"низкий|средний|высокий","сравнение":[{"пункт":"","статус":"устранена|осталась|изменена","почему":"до 15 слов"}],"новые_ловушки":[{"пункт":"","цитата":"","опасность":"до 20 слов","просить":"до 15 слов","уровень":"средний|высокий"}],"числа":{"платёж":null,"штраф_в_день_процент":null,"залог":null}}`;

// 3. Counterpart letter system instruction (exact user instruction)
const SYSTEM_INSTRUCTION_LETTER = `Напиши вежливое деловое письмо на русском до 120 слов: 3 просьбы об изменении и один запасной вариант-компромисс. Места для имён в [скобках]. Только текст письма.`;

// Preferred model is fast & light Gemini Flash-Lite; fallback to Flash
const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-3.8-flash';

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }
  return cleaned;
}

/**
 * Execute Gemini call with fallback from Flash-Lite to Flash, and retry on transient errors
 */
async function callGeminiOptimized(
  ai: GoogleGenAI,
  requestConfig: {
    systemInstruction: string;
    contents: any;
    maxOutputTokens: number;
    responseMimeType?: string;
  }
): Promise<string> {
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: any;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: requestConfig.contents,
          config: {
            systemInstruction: requestConfig.systemInstruction,
            maxOutputTokens: requestConfig.maxOutputTokens,
            responseMimeType: requestConfig.responseMimeType,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
        });

        const text = response.text || '';
        if (text.trim()) {
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const isModelNotFound = msg.includes('not found') || msg.includes('unsupported') || msg.includes('INVALID_ARGUMENT');
        if (isModelNotFound) {
          // Break immediately to fallback model
          break;
        }
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED');
        if (isTransient && attempt === 1) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
      }
    }
  }

  throw lastError || new Error('Не удалось получить ответ от ИИ модели.');
}

function formatFriendlyError(error: any): string {
  const raw = String(error?.message || error || '');
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'Сервис Gemini временно перегружен запросами. Нажмите «Повторить».';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Превышен лимит запросов к ИИ. Подождите несколько секунд и нажмите «Повторить».';
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return 'Указанный ключ GEMINI_API_KEY недействителен.';
  }
  return `Ошибка при обращении к ИИ: ${raw.slice(0, 150)}`;
}

export async function handleAnalyzeRequest(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается. Разрешен только POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Ключ доступа GEMINI_API_KEY не настроен на сервере.',
    });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const body = req.body || {};
  const { action } = body;

  try {
    // -------------------------------------------------------------------------
    // 1. PRIMARY CHECK (ПЕРВИЧНАЯ ПРОВЕРКА): max 1200 tokens
    // -------------------------------------------------------------------------
    if (action === 'check_traps') {
      const { fileText, fileBase64, mimeType } = body;

      if (!fileText && !fileBase64) {
        return res.status(400).json({ error: 'Текст или изображение договора не переданы для анализа.' });
      }

      let contents: any;
      if (fileText) {
        // Send pure text to model (minimizes tokens)
        contents = `Текст договора:\n${fileText}`;
      } else {
        // Fallback for resized images (PNG/JPG)
        const imgMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
        contents = {
          parts: [
            {
              inlineData: {
                mimeType: imgMime,
                data: fileBase64,
              },
            },
            {
              text: 'Проверь договор на изображении согласно системной инструкции.',
            },
          ],
        };
      }

      const responseText = await callGeminiOptimized(ai, {
        systemInstruction: SYSTEM_INSTRUCTION_PRIMARY,
        contents,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
      });

      let parsed: any;
      try {
        const cleaned = cleanJsonString(responseText);
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Failed to parse primary check JSON:', parseErr, responseText);
        return res.status(500).json({
          error: 'Ответ модели поступил в неверном формате. Попробуйте повторить запрос.',
        });
      }

      // Normalize data for frontend compatibility
      const riskLevel = parsed.риск || parsed.общий_уровень_риска || 'средний';
      const rawTraps = Array.isArray(parsed.ловушки) ? parsed.ловушки : [];
      const normalizedTraps = rawTraps.map((t: any, index: number) => ({
        пункт: t.пункт || `№${index + 1}`,
        цитата: t.цитата || '',
        опасность: t.опасность || t.чем_опасно || 'Выявлено невыгодное условие',
        чем_опасно: t.опасность || t.чем_опасно || 'Выявлено невыгодное условие',
        просить: t.просить || t.что_просить || 'Предложить изменить условие',
        что_просить: t.просить || t.что_просить || 'Предложить изменить условие',
        уровень: t.уровень === 'высокий' ? 'высокий' : 'средний',
      }));

      const rawNumbers = parsed.числа || {};
      const normalizedNumbers = {
        платёж: rawNumbers.платёж ?? rawNumbers.ежемесячный_платёж ?? null,
        ежемесячный_платёж: rawNumbers.платёж ?? rawNumbers.ежемесячный_платёж ?? null,
        штраф_в_день_процент: rawNumbers.штраф_в_день_процент ?? rawNumbers.процент_штрафа_в_день ?? null,
        процент_штрафа_в_день: rawNumbers.штраф_в_день_процент ?? rawNumbers.процент_штрафа_в_день ?? null,
        залог: rawNumbers.залог ?? null,
        лимит_штрафа: rawNumbers.лимит_штрафа ?? null,
        срок_уведомления_дней: rawNumbers.срок_уведомления_дней ?? null,
        срок_договора_месяцев: rawNumbers.срок_договора_месяцев ?? null,
      };

      return res.status(200).json({
        риск: riskLevel,
        общий_уровень_риска: riskLevel,
        ловушки: normalizedTraps,
        числа: normalizedNumbers,
      });

    // -------------------------------------------------------------------------
    // 2. RECHECK AGREED VERSION (ПОВТОРНАЯ ПРОВЕРКА): max 600 tokens
    // -------------------------------------------------------------------------
    } else if (action === 'recheck_agreed') {
      const { fileText, fileBase64, mimeType, previousTraps } = body;

      if (!fileText && !fileBase64) {
        return res.status(400).json({ error: 'Текст новой версии договора не передан для проверки.' });
      }

      const trapsSummary = Array.isArray(previousTraps) && previousTraps.length > 0
        ? previousTraps.map((t: any, i: number) => {
            const p = t.пункт || `№${i + 1}`;
            const s = t.суть || t.опасность || t.чем_опасно || '';
            return `${i + 1}. Пункт ${p}: ${s}`;
          }).join('\n')
        : 'Список ранее найденных ловушек пуст.';

      let contents: any;
      if (fileText) {
        contents = `Ранее найденные ловушки:\n${trapsSummary}\n\nНовая версия договора:\n${fileText}`;
      } else {
        const imgMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
        contents = {
          parts: [
            {
              inlineData: {
                mimeType: imgMime,
                data: fileBase64,
              },
            },
            {
              text: `Ранее найденные ловушки:\n${trapsSummary}\n\nСравни новую версию договора со списком согласно системной инструкции.`,
            },
          ],
        };
      }

      const responseText = await callGeminiOptimized(ai, {
        systemInstruction: SYSTEM_INSTRUCTION_RECHECK,
        contents,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
      });

      let parsed: any;
      try {
        const cleaned = cleanJsonString(responseText);
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Failed to parse recheck JSON:', parseErr, responseText);
        return res.status(500).json({
          error: 'Ответ модели поступил в неверном формате. Попробуйте повторить запрос.',
        });
      }

      const comparison = Array.isArray(parsed.сравнение) ? parsed.сравнение : [];
      const newTrapsRaw = Array.isArray(parsed.новые_ловушки) ? parsed.новые_ловушки : [];

      const normalizedNewTraps = newTrapsRaw.map((t: any, idx: number) => ({
        пункт: t.пункт || `Новый №${idx + 1}`,
        цитата: t.цитата || '',
        опасность: t.опасность || t.чем_опасно || '',
        чем_опасно: t.опасность || t.чем_опасно || '',
        просить: t.просить || t.что_просить || '',
        что_просить: t.просить || t.что_просить || '',
        уровень: t.уровень === 'высокий' ? 'высокий' : 'средний',
      }));

      // Calculate progress: "Устранено X из N"
      const totalCount = Array.isArray(previousTraps) && previousTraps.length > 0
        ? previousTraps.length
        : comparison.length;

      const eliminatedCount = comparison.filter((c: any) =>
        String(c.статус || '').toLowerCase().includes('устран')
      ).length;

      const remainingTraps = [
        ...comparison.filter((c: any) => !String(c.статус || '').toLowerCase().includes('устран')).map((c: any) => ({
          пункт: c.пункт || '',
          цитата: '',
          опасность: `${c.статус === 'изменена' ? 'Условие изменено: ' : 'Условие осталось: '}${c.почему || ''}`,
          чем_опасно: `${c.статус === 'изменена' ? 'Условие изменено: ' : 'Условие осталось: '}${c.почему || ''}`,
          просить: 'Проверить формулировку',
          что_просить: 'Проверить формулировку',
          уровень: c.статус === 'осталась' ? 'высокий' : 'средний',
        })),
        ...normalizedNewTraps,
      ];

      const rawNumbers = parsed.числа || {};
      const normalizedNumbers = {
        платёж: rawNumbers.платёж ?? rawNumbers.ежемесячный_платёж ?? null,
        ежемесячный_платёж: rawNumbers.платёж ?? rawNumbers.ежемесячный_платёж ?? null,
        штраф_в_день_процент: rawNumbers.штраф_в_день_процент ?? rawNumbers.процент_штрафа_в_день ?? null,
        процент_штрафа_в_день: rawNumbers.штраф_в_день_процент ?? rawNumbers.процент_штрафа_в_день ?? null,
        залог: rawNumbers.залог ?? null,
        лимит_штрафа: rawNumbers.лимит_штрафа ?? null,
        срок_уведомления_дней: rawNumbers.срок_уведомления_дней ?? null,
        срок_договора_месяцев: rawNumbers.срок_договора_месяцев ?? null,
      };

      // Overall risk for the agreed version
      let riskLevel: 'низкий' | 'средний' | 'высокий' = parsed.риск || 'низкий';
      if (!parsed.риск) {
        if (remainingTraps.some((t: any) => t.уровень === 'высокий')) {
          riskLevel = 'высокий';
        } else if (remainingTraps.length > 0) {
          riskLevel = 'средний';
        } else {
          riskLevel = 'низкий';
        }
      }

      return res.status(200).json({
        риск: riskLevel,
        общий_уровень_риска: riskLevel,
        сравнение: comparison.map((c: any) => ({
          пункт: c.пункт || '',
          статус: String(c.статус || '').toLowerCase().includes('устран')
            ? 'устранена'
            : String(c.статус || '').toLowerCase().includes('измен')
            ? 'изменена'
            : 'осталась',
          почему: c.почему || '',
        })),
        новые_ловушки: normalizedNewTraps,
        ловушки: remainingTraps,
        числа: normalizedNumbers,
        прогресс: {
          устранено: eliminatedCount,
          всего: totalCount,
          процент: totalCount > 0 ? Math.round((eliminatedCount / totalCount) * 100) : 100,
        },
      });

    // -------------------------------------------------------------------------
    // 3. GENERATE LETTER (ПИСЬМО): max 350 tokens, sending ONLY found traps
    // -------------------------------------------------------------------------
    } else if (action === 'generate_letter') {
      const { traps } = body;

      if (!traps || !Array.isArray(traps) || traps.length === 0) {
        return res.status(400).json({
          error: 'Для составления письма не переданы выявленные ловушки.',
        });
      }

      // Send ONLY found traps (no full contract text)
      const trapsSummary = traps.slice(0, 5).map((t: any, index: number) => {
        const itemNumber = t.пункт || `№${index + 1}`;
        const danger = t.опасность || t.чем_опасно || 'Рискованное условие';
        const request = t.просить || t.что_просить || 'Изменить формулировку на паритетную';
        return `${index + 1}. Пункт ${itemNumber}: ${danger}. Просьба: ${request}`;
      }).join('\n');

      const prompt = `Список условий для изменения в договоре:\n${trapsSummary}\n\nНапиши вежливое деловое письмо согласно системной инструкции.`;

      const letterText = await callGeminiOptimized(ai, {
        systemInstruction: SYSTEM_INSTRUCTION_LETTER,
        contents: prompt,
        maxOutputTokens: 350,
      });

      return res.status(200).json({ letter: letterText.trim() });

    } else {
      return res.status(400).json({
        error: `Неизвестное действие: ${action}. Ожидалось "check_traps", "recheck_agreed" или "generate_letter".`,
      });
    }

  } catch (error: any) {
    console.error('API /api/analyze error:', error);
    const friendlyMessage = formatFriendlyError(error);
    return res.status(500).json({
      error: friendlyMessage,
    });
  }
}

// Export default for Vercel Serverless Function compatibility
export default async function handler(req: any, res: any) {
  return handleAnalyzeRequest(req, res);
}
