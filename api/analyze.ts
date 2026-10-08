/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

// @ts-ignore
import mammoth from 'mammoth';

const SYSTEM_INSTRUCTION_STEP1 = `Ты помощник, который проверяет договоры для предпринимателей и малого бизнеса в Казахстане. Твоя задача: прочитать договор и найти условия, которые могут быть невыгодны стороне, подписывающей договор, и объяснить их простым языком человеку без юридического образования.

Как анализировать:
1. Сначала определи тип договора (аренда, оказание услуг, поставка, подряд и т.д.) и стороны. Если непонятно, какую сторону представляет пользователь, анализируй с точки зрения более слабой стороны (арендатор, заказчик, покупатель, исполнитель без предоплаты).
2. Читай договор пункт за пунктом и ищи: автоматическое продление и сроки уведомления; одностороннее изменение цены или условий; неравные штрафы и неустойки (разные проценты или лимиты для сторон, отсутствие лимита); неравные сроки уведомления об отказе и расторжении; скрытые платежи и сборы; обеспечительные платежи и условия их невозврата; возмещение расходов без подтверждающих документов; право второй стороны входить, проверять или менять условия без предупреждения; неудобная подсудность; противоречия и ошибки (суммы цифрами и словами не совпадают, пункты противоречат друг другу, неясные формулировки вроде «по усмотрению», «по рыночной цене» без порядка расчёта); отсутствие важного (нет срока, суммы, порядка расчётов).
3. Для каждой находки укажи номер пункта, дословную цитату из договора, объясни простыми словами, чем это опасно, и предложи, что попросить исправить. Не выдумывай: если условия нет в тексте, не упоминай его. Не цитируй то, чего нет в документе.
4. Уровень каждой находки: «высокий», если условие может привести к существенным потерям или лишает защиты; «средний», если создаёт неудобство или риск при определённых обстоятельствах. Не выдавай процентов безопасности и оценок вроде «87%».
5. Все числа (суммы, проценты, сроки в днях) извлекай дословно из текста. Если числа в договоре нет, ставь null. Ничего не считай и не оценивай сам: расчёты сделает код.
6. Не давай юридических заключений вроде «условие незаконно» и не гарантируй исход. Если формулировка неоднозначна, так и скажи.
7. Если текст не читается или это не договор, верни поле error с коротким объяснением.

Отвечай только JSON без пояснений и без markdown, на русском языке.

Формат JSON:
{"тип_договора": string, "стороны": [string], "общий_уровень_риска": "низкий" | "средний" | "высокий", "ловушки": [{"пункт": string, "цитата": string, "чем_опасно": string, "уровень": "средний" | "высокий", "что_просить": string}], "числа": {"ежемесячный_платёж": number|null, "процент_штрафа_в_день": number|null, "лимит_штрафа": string|null, "залог": number|null, "срок_уведомления_дней": number|null, "срок_договора_месяцев": number|null}, "важные_сроки": [{"что": string, "когда": string}], "вопросы_юристу": [string], "error": string|null}`;

const SYSTEM_INSTRUCTION_STEP2 = `Ты помогаешь предпринимателю в Казахстане договориться об изменении условий договора с другой стороной. Напиши готовое деловое письмо на русском языке.

Требования к письму:
1. Тон вежливый, деловой и конструктивный. Без обвинений, угроз и юридических терминов, которые пользователь не поймёт. Цель: договориться, а не поссориться.
2. Структура: короткое обращение; одна строка благодарности или заинтересованности в сотрудничестве; фраза о том, что после изучения проекта договора есть несколько предложений; пронумерованные просьбы; запасной вариант; завершение с просьбой ответить к определённому сроку и готовностью обсудить.
3. Выбери 3–5 самых важных просьб (в первую очередь ловушки высокого уровня). Для каждой просьбы укажи номер пункта, коротко объясни, что именно предлагается изменить, и дай одну деловую причину (например, «чтобы условия были равными для обеих сторон»).
4. Для 1–2 самых спорных пунктов предложи запасной вариант-компромисс, на случай если другая сторона не согласится (например, снизить лимит неустойки вместо полного отказа от неё).
5. Используй только пункты и факты из переданного списка ловушек. Не выдумывай пункты, суммы, названия сторон и даты. Если названия сторон неизвестны, оставь места для подстановки в квадратных скобках: [Название компании], [Имя], [Дата].
6. Не обещай исход и не утверждай, что условия незаконны.
7. Длина письма до 250 слов, текст без лишних украшений.

Верни только текст письма.`;

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }
  return cleaned;
}

async function callGeminiWithRetry(fn: () => Promise<any>, retries = 3, delayMs = 1500): Promise<any> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isTransient = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429') || errMsg.includes('high demand') || errMsg.includes('RESOURCE_EXHAUSTED');
      if (isTransient && attempt < retries) {
        console.warn(`Gemini call attempt ${attempt} failed with transient error, retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function formatFriendlyError(error: any): string {
  const raw = String(error?.message || error || '');
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'Сервис Gemini временно перегружен запросами. Пожалуйста, нажмите «Повторить».';
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
    if (action === 'check_traps') {
      const { fileName, mimeType, fileBase64, fileText } = body;

      if (!fileBase64 && !fileText) {
        return res.status(400).json({ error: 'Файл договора не передан для анализа.' });
      }

      const contentsParts: any[] = [];

      const lowerName = (fileName || '').toLowerCase();
      const isPdf = (mimeType && mimeType.includes('pdf')) || lowerName.endsWith('.pdf');
      const isImage = (mimeType && mimeType.startsWith('image/')) || /\.(png|jpe?g|webp)$/i.test(lowerName);
      const isDocx = (mimeType && (mimeType.includes('wordprocessingml') || mimeType.includes('docx'))) || lowerName.endsWith('.docx');

      if (isPdf && fileBase64) {
        contentsParts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: fileBase64,
          },
        });
        contentsParts.push({
          text: `Перед тобой проект договора в формате PDF (${fileName || 'документ'}). Внимательно проанализируй все его пункты и выяви условия, опасные для подписывающей стороны, согласно системной инструкции. Верни только JSON.`,
        });
      } else if (isImage && fileBase64) {
        const imgMime = mimeType && mimeType.startsWith('image/')
          ? mimeType
          : (lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg');
        contentsParts.push({
          inlineData: {
            mimeType: imgMime,
            data: fileBase64,
          },
        });
        contentsParts.push({
          text: `Перед тобой изображение договора или страницы документа (${fileName || 'договор'}). Внимательно прочитай весь текст на изображении, проанализируй все его пункты и выяви условия, опасные для подписывающей стороны, согласно системной инструкции. Верни только JSON.`,
        });
      } else if (isDocx && fileBase64) {
        let textContent = '';
        try {
          const docBuffer = Buffer.from(fileBase64, 'base64');
          const mammothResult = await mammoth.extractRawText({ buffer: docBuffer });
          textContent = mammothResult.value;
        } catch (docxErr) {
          console.error('Failed to parse docx via mammoth:', docxErr);
        }

        if (!textContent || textContent.trim().length === 0) {
          return res.status(400).json({
            error: 'Не удалось извлечь текст из файла DOCX. Убедитесь, что файл содержит текст договора и не повреждён.',
          });
        }

        contentsParts.push({
          text: `Текст документа для анализа из файла DOCX (${fileName || 'договор'}):\n\n${textContent}\n\nПроанализируй текст договора в соответствии с системной инструкции и верни строго JSON.`,
        });
      } else {
        // Plain text document
        let textContent = fileText;
        if (!textContent && fileBase64) {
          try {
            textContent = Buffer.from(fileBase64, 'base64').toString('utf-8');
          } catch {
            textContent = '';
          }
        }

        if (!textContent || textContent.trim().length === 0) {
          return res.status(400).json({
            error: 'Не удалось прочитать текст файла. Убедитесь, что файл не пустой и содержит текстовые данные.',
          });
        }

        contentsParts.push({
          text: `Текст документа для анализа (${fileName || 'договор'}):\n\n${textContent}\n\nПроанализируй текст договора в соответствии с системной инструкцией и верни строго JSON.`,
        });
      }

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: contentsParts,
          },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_STEP1,
            responseMimeType: 'application/json',
          },
        })
      );

      const responseText = response.text || '';
      if (!responseText.trim()) {
        return res.status(500).json({
          error: 'ИИ не вернул ответ при проверке договора. Пожалуйста, попробуйте снова.',
        });
      }

      let parsedData: any;
      try {
        const cleaned = cleanJsonString(responseText);
        parsedData = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Failed to parse Gemini response as JSON:', parseErr, responseText);
        return res.status(500).json({
          error: 'Ответ модели поступил в неверном формате. Попробуйте повторить запрос.',
        });
      }

      return res.status(200).json(parsedData);

    } else if (action === 'generate_letter') {
      const { contractType, parties, traps } = body;

      if (!traps || !Array.isArray(traps) || traps.length === 0) {
        return res.status(400).json({
          error: 'Для составления письма не переданы выявленные ловушки.',
        });
      }

      const trapsSummary = traps.map((t: any, index: number) => {
        return `${index + 1}. Пункт: ${t.пункт || 'Без номера'}\n   Уровень: ${t.уровень || 'средний'}\n   Цитата: ${t.цитата || '—'}\n   В чём опасность: ${t.чем_опасно || '—'}\n   Что попросить: ${t.что_просить || '—'}`;
      }).join('\n\n');

      const prompt = `Тип договора: ${contractType || 'Не указан'}
Стороны договора: ${Array.isArray(parties) && parties.length > 0 ? parties.join(', ') : 'Не указаны'}

Список выявленных условий и ловушек:
${trapsSummary}

Составь вежливое деловое письмо контрагенту согласно системной инструкции. Верни только текст письма.`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_STEP2,
          },
        })
      );

      const letterText = response.text?.trim() || '';
      if (!letterText) {
        return res.status(500).json({
          error: 'ИИ не вернул текст письма. Пожалуйста, попробуйте снова.',
        });
      }

      return res.status(200).json({ letter: letterText });

    } else {
      return res.status(400).json({
        error: `Неизвестное действие: ${action}. Ожидалось "check_traps" или "generate_letter".`,
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
