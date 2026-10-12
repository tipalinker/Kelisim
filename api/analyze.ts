/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const LANG_DIRECTIVE_EN =
  'Respond in English. Every text value in the JSON (explanations, what to ask, deadlines, lawyer questions, letter text) must be in English, even if the contract is in Russian. Keep quotes from the contract exactly as in the original.';

const LANG_DIRECTIVE_RU =
  'Отвечай на русском. Цитаты из договора оставляй дословно.';

// 1. Primary check system instructions
function getSystemInstructionPrimary(lang: 'en' | 'ru'): string {
  if (lang === 'en') {
    return `You are a leading commercial contract auditor for entrepreneurs and small businesses in Kazakhstan (LLPs, Sole Proprietorships).
Your task is to identify hidden legal deadlocks, cancellation traps, and unfair circumvention clauses in the contract text.

Find at most 5 most dangerous terms for the signing party, paying special attention to:
1. LEGAL DEADLOCKS:
   - One-sided cancellation trap: ban on unilateral termination, or exorbitant penalty/forfeiture of deposit upon cancellation (while the counterparty can leave at any time).
   - Auto-renewal trap: automatic renewal of contract with a narrow notice window (60-90 days) without right to terminate during the new period.
   - Territorial and court deadlock: jurisdiction in a remote region or in a closed private arbitration court with prohibitive fees.
   - Non-refundable deposit: withholding of security deposit for any pretext.
   - Acceptance deadlocks: tacit agreement ("if not disputed within 2-3 days, work is deemed accepted") or counterparty delay in signing acceptance certificates blocking payment.
2. CIRCUMVENTION DETAILS & TRICKS:
   - Unilateral changes to prices/rates "via publication on counterparty website" without written consent.
   - Penalty asymmetry: draconian daily late penalty (0.3-1% per day WITHOUT cap) vs zero/symbolic penalty for the counterparty.
   - Shifting third-party risks: shifting state fines (tax, fire, sanitary) or lost profits "regardless of fault".

ANALYSIS RULES:
- Extract ONLY what is genuinely present in the document text.
- Clause (пункт): exact clause number or section title from the contract.
- Quote (цитата): exact verbatim quote from contract text up to 15 words.
- Danger (опасность): plain-language explanation of deadlock or loophole in English (up to 20 words).
- Proposal (просить): balanced negotiation wording in English (up to 15 words).
- Level (уровень): "high" or "medium".
- Numbers: extract verbatim from text; if parameter not specified, return null.

Respond strictly with JSON keeping these exact keys (do not change key names):
{"риск":"low|medium|high","ловушки":[{"пункт":"","цитата":"","опасность":"up to 20 words in English","просить":"up to 15 words in English","уровень":"medium|high"}],"числа":{"платёж":null,"штраф_в_день_процент":null,"залог":null,"лимит_штрафа":null,"срок_уведомления_дней":null,"срок_договора_месяцев":null}}`;
  }

  return `Ты — ведущий юридический аудитор коммерческих договоров для предпринимателей и малого бизнеса в Казахстане (ИП, ТОО).
Твоя задача — выявить скрытые юридические тупики, капканы расторжения и недобросовестные обходные детали в тексте договора.

Найди не более 5 самых опасных для подписывающего условий, уделяя особое внимание:
1. ЮРИДИЧЕСКИМ ТУПИКАМ:
   - Кабальный выход: запрет на односторонний отказ, либо огромный штраф/потеря обеспечения при расторжении (при этом контрагент может выйти в любой момент).
   - Ловушка автопродления: автоматическая пролонгация договора с узким окном уведомления (за 60-90 дней) без права выхода в течение нового периода.
   - Территориальный и судебный тупик: подсудность в другом удалённом регионе или в карманном закрытом третейском арбитраже с неподъёмными сборами.
   - Невозвратный залог: удержание обеспечительного платежа/депозита по любому формальному или надуманному поводу.
   - Тупики приёмки: молчаливое согласие в пользу контрагента ("не оспорил за 2-3 дня — работы приняты без претензий") или затягивание подписания актов со стороны контрагента, блокирующее оплату.
2. ОБХОДНЫМ ДЕТАЛЯМ И УЛОВКАМ:
   - Одностороннее изменение цен/тарифов/условий "путём публикации на веб-сайте контрагента" без персонального письменного согласования.
   - Асимметрия штрафов: драконовская пеня за просрочку платежа (от 0.3-1% в день БЕЗ предельного лимита) против нулевой или символической пени контрагента.
   - Обход согласования расходов: перекладывание сопутствующих затрат без предварительной сметы и подтверждающих актов.
   - Сброс чужих рисков: перекладывание штрафов госорганов (налоговая, СЭС, пожарные) и упущенной выгоды "независимо от вины".

ПРАВИЛА АНАЛИЗА:
- Извлекай ТОЛЬКО то, что реально содержится в тексте документа (без домыслов и галлюцинаций).
- Пункт: точный номер или название раздела из договора.
- Цитата: дословная цитата из текста не длиннее 15 слов.
- Опасность: суть тупика или обходной лазейки простыми словами до 20 слов на русском.
- Просить: готовая паритетная формулировка для переговоров до 15 слов на русском.
- Уровень: "высокий" или "средний".
- Числа извлекай дословно из текста; если параметр не указан, укажи null.

Отвечай строго JSON на русском:
{"риск":"низкий|средний|высокий","ловушки":[{"пункт":"","цитата":"","опасность":"до 20 слов","просить":"до 15 слов","уровень":"средний|высокий"}],"числа":{"платёж":null,"штраф_в_день_процент":null,"залог":null,"лимит_штрафа":null,"срок_уведомления_дней":null,"срок_договора_месяцев":null}}`;
}

// 2. Recheck system instructions
function getSystemInstructionRecheck(lang: 'en' | 'ru'): string {
  if (lang === 'en') {
    return `You are a legal auditor of commercial contracts in Kazakhstan. Compare the new version of the contract with the list of previously identified traps.
Check whether the counterparty genuinely eliminated the risks or used sneaky workarounds (e.g. removed penalty from one clause, but added restrictions in force majeure or shifted dispute resolution to private arbitration).

For each previously identified trap, specify status:
- "resolved" (or "устранена") — clause removed or brought to fair parity;
- "remained" (or "осталась") — clause unchanged or still unfair;
- "modified" (or "изменена") — wording rewritten, but retains risks or circumvention detail. In "почему" field explain the essence in English up to 15 words.

Then find at most 3 NEW dangerous clauses or loopholes appearing in the new edition. Only what is present in the text. Quotes from contract must remain verbatim in their original text.

Respond strictly with JSON keeping these exact keys (do not change key names):
{"риск":"low|medium|high","сравнение":[{"пункт":"","статус":"resolved|remained|modified","почему":"up to 15 words in English"}],"новые_ловушки":[{"пункт":"","цитата":"","опасность":"up to 20 words in English","просить":"up to 15 words in English","уровень":"medium|high"}],"числа":{"платёж":null,"штраф_в_день_процент":null,"залог":null,"лимит_штрафа":null,"срок_уведомления_дней":null,"срок_договора_месяцев":null}}`;
  }

  return `Ты — юридический аудитор коммерческих договоров в Казахстане. Сравни новую версию договора со списком ранее выявленных ловушек.
Проверь, устранил ли контрагент риски честно или применил обходные маневры (например, убрал штраф из одного пункта, но перенёс ограничение в форс-мажор, изменил подсудность на третейский суд или добавил скрытые комиссии).

Для каждой ранее найденной ловушки укажи статус:
- «устранена» — условие удалено или приведено к справедливому паритету;
- «осталась» — условие не изменилось или осталось кабальным;
- «изменена» — формулировка переписана, но сохраняет риски или обходную деталь. В поле "почему" объясни суть до 15 слов на русском.

Затем найди не более 3 НОВЫХ опасных условий или обходных лазеек, появившихся в новой редакции. Только то, что есть в тексте.

Отвечай строго JSON на русском:
{"риск":"низкий|средний|высокий","сравнение":[{"пункт":"","статус":"устранена|осталась|изменена","почему":"до 15 слов"}],"новые_ловушки":[{"пункт":"","цитата":"","опасность":"до 20 слов","просить":"до 15 слов","уровень":"средний|высокий"}],"числа":{"платёж":null,"штраф_в_день_процент":null,"залог":null,"лимит_штрафа":null,"срок_уведомления_дней":null,"срок_договора_месяцев":null}}`;
}

// 3. Counterpart letter system instructions
function getSystemInstructionLetter(lang: 'en' | 'ru'): string {
  if (lang === 'en') {
    return `You are an experienced business negotiator. Write a tactful and reasoned business letter to the counterparty in English up to 130 words.
Goal: eliminate legal deadlocks and terms imbalance while preserving a strong partnership.
Structure:
1. Polite greeting and confirmation of interest in working together.
2. Up to 3 specific proposals to resolve deadlocks/loopholes (emphasizing parity, mutual benefit, and standard business practice).
3. One alternative compromise option (win-win) addressing counterparty concerns.
Use [square brackets] for names and company titles. Return ONLY the ready letter text without conversational intros or preamble.`;
  }

  return `Ты — опытный деловой переговорщик в бизнесе. Напиши тактичное и аргументированное деловое письмо контрагенту на русском языке до 130 слов.
Цель: устранить юридические тупики и дисбаланс условий, сохранив партнёрские отношения.
Структура:
1. Вежливое приветствие и подтверждение заинтересованности в совместной работе.
2. До 3 конкретных предложений по устранению тупиков/лазеек (с упором на паритет, баланс интересов и стандартную деловую практику).
3. Один запасной компромиссный вариант (win-win), снимающий опасения контрагента.
Места для имён и названий указывай в [квадратных скобках]. Верни ТОЛЬКО готовый текст письма без вводных фраз.`;
}

const normalizeRiskLevel = (val: any, lang: 'en' | 'ru' = 'en'): 'низкий' | 'средний' | 'высокий' | 'low' | 'medium' | 'high' => {
  const str = String(val || '').toLowerCase();
  if (str.includes('высок') || str.includes('high')) return lang === 'ru' ? 'высокий' : 'high';
  if (str.includes('низк') || str.includes('low')) return lang === 'ru' ? 'низкий' : 'low';
  return lang === 'ru' ? 'средний' : 'medium';
};

const normalizeItemLevel = (val: any, lang: 'en' | 'ru' = 'en'): 'средний' | 'высокий' | 'medium' | 'high' => {
  const str = String(val || '').toLowerCase();
  if (str.includes('высок') || str.includes('high')) return lang === 'ru' ? 'высокий' : 'high';
  return lang === 'ru' ? 'средний' : 'medium';
};

const normalizeStatus = (val: any, lang: 'en' | 'ru' = 'en'): 'устранена' | 'изменена' | 'осталась' | 'resolved' | 'modified' | 'remains' => {
  const str = String(val || '').toLowerCase();
  if (str.includes('устран') || str.includes('resolv') || str.includes('elim') || str.includes('fixed')) {
    return lang === 'ru' ? 'устранена' : 'resolved';
  }
  if (str.includes('измен') || str.includes('mod') || str.includes('chang')) {
    return lang === 'ru' ? 'изменена' : 'modified';
  }
  return lang === 'ru' ? 'осталась' : 'remains';
};

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

function formatFriendlyError(error: any, lang: 'en' | 'ru' = 'en'): string {
  const raw = String(error?.message || error || '');
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return lang === 'ru'
      ? 'Сервис Gemini временно перегружен запросами. Нажмите «Повторить».'
      : 'Gemini service is temporarily overloaded. Please retry.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return lang === 'ru'
      ? 'Превышен лимит запросов к ИИ. Подождите несколько секунд и нажмите «Повторить».'
      : 'AI rate limit exceeded. Please wait a few seconds and retry.';
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return lang === 'ru'
      ? 'Указанный ключ GEMINI_API_KEY недействителен.'
      : 'The GEMINI_API_KEY is invalid.';
  }
  return lang === 'ru'
    ? `Ошибка при обращении к ИИ: ${raw.slice(0, 150)}`
    : `AI request error: ${raw.slice(0, 150)}`;
}

export async function handleAnalyzeRequest(req: any, res: any) {
  const body = req.body || {};
  const { action } = body;
  // If language is not provided, default to English
  const lang: 'en' | 'ru' = body.lang === 'ru' ? 'ru' : 'en';
  const langDirective = lang === 'ru' ? LANG_DIRECTIVE_RU : LANG_DIRECTIVE_EN;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: lang === 'ru' ? 'Метод не поддерживается. Разрешен только POST.' : 'Method not supported. Only POST is allowed.',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: lang === 'ru' ? 'Ключ доступа GEMINI_API_KEY не настроен на сервере.' : 'GEMINI_API_KEY is not configured on the server.',
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

  try {
    // -------------------------------------------------------------------------
    // 1. PRIMARY CHECK (ПЕРВИЧНАЯ ПРОВЕРКА): max 1200 tokens
    // -------------------------------------------------------------------------
    if (action === 'check_traps') {
      const { fileText, fileBase64, mimeType, userRules } = body;

      if (!fileText && !fileBase64) {
        return res.status(400).json({ error: lang === 'en' ? 'Contract text or image was not provided for analysis.' : 'Текст или изображение договора не переданы для анализа.' });
      }

      let contents: any;
      if (fileText) {
        // Send language instruction as first line, followed by contract text
        contents = `${langDirective}\n${fileText}`;
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
              text: `${langDirective}\n${
                lang === 'en' 
                  ? 'Audit the contract on this image according to the system instruction.'
                  : 'Проверь договор на изображении согласно системной инструкции.'
              }`,
            },
          ],
        };
      }

      let systemInstruction = getSystemInstructionPrimary(lang);
      const hasUserRules = typeof userRules === 'string' && userRules.trim().length > 0;
      if (hasUserRules) {
        if (lang === 'en') {
          systemInstruction += `\n\nUser business rules: ${userRules.trim()}\nCheck contract against user rules as well. If a term violates a rule, add it to field "нарушения_правил": {"пункт":"","правило":"","что_в_договоре":""}. If no violations, return empty array [].\nIn JSON response include: "нарушения_правил":[{"пункт":"","правило":"","что_в_договоре":""}]`;
        } else {
          systemInstruction += `\n\nПравила пользователя: ${userRules.trim()}\nПроверь договор также по правилам пользователя. Если условие нарушает правило, добавь его в поле нарушения_правил: пункт, правило, что в договоре. Если нарушений нет, верни пустой массив [].\nВ JSON ответе добавь поле: "нарушения_правил":[{"пункт":"","правило":"","что_в_договоре":""}]`;
        }
      }
      systemInstruction = `${systemInstruction}\n\n${langDirective}`;

      const responseText = await callGeminiOptimized(ai, {
        systemInstruction,
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
          error: lang === 'en' ? 'Model response was received in an invalid format. Please retry.' : 'Ответ модели поступил в неверном формате. Попробуйте повторить запрос.',
        });
      }

      // Normalize data for frontend compatibility
      const riskLevel = normalizeRiskLevel(parsed.риск || parsed.общий_уровень_риска, lang);
      const rawTraps = Array.isArray(parsed.ловушки) ? parsed.ловушки : [];
      const defaultDanger = lang === 'en' ? 'Unfavorable clause identified' : 'Выявлено невыгодное условие';
      const defaultProposal = lang === 'en' ? 'Propose revising clause wording' : 'Предложить изменить условие';

      const normalizedTraps = rawTraps.map((t: any, index: number) => ({
        пункт: t.пункт || `${lang === 'en' ? 'Clause #' : '№'}${index + 1}`,
        цитата: t.цитата || '',
        опасность: t.опасность || t.чем_опасно || defaultDanger,
        чем_опасно: t.опасность || t.чем_опасно || defaultDanger,
        просить: t.просить || t.что_просить || defaultProposal,
        что_просить: t.просить || t.что_просить || defaultProposal,
        уровень: normalizeItemLevel(t.уровень, lang),
      }));

      const rawViolations = Array.isArray(parsed.нарушения_правил) ? parsed.нарушения_правил : [];
      const normalizedViolations = rawViolations.map((v: any, index: number) => ({
        пункт: v.пункт || `${lang === 'en' ? 'Clause #' : '№'}${index + 1}`,
        правило: v.правило || '',
        что_в_договоре: v.что_в_договоре || v.в_договоре || '',
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
        нарушения_правил: normalizedViolations,
      });

    // -------------------------------------------------------------------------
    // 2. RECHECK AGREED VERSION (ПОВТОРНАЯ ПРОВЕРКА): max 600 tokens
    // -------------------------------------------------------------------------
    } else if (action === 'recheck_agreed') {
      const { fileText, fileBase64, mimeType, previousTraps } = body;

      if (!fileText && !fileBase64) {
        return res.status(400).json({ error: lang === 'en' ? 'Revised contract text was not provided for check.' : 'Текст новой версии договора не передан для проверки.' });
      }

      const trapsSummary = Array.isArray(previousTraps) && previousTraps.length > 0
        ? previousTraps.map((t: any, i: number) => {
            const p = t.пункт || `${lang === 'en' ? 'Clause #' : '№'}${i + 1}`;
            const s = t.суть || t.опасность || t.чем_опасно || '';
            return `${i + 1}. ${p}: ${s}`;
          }).join('\n')
        : (lang === 'en' ? 'List of previously identified traps is empty.' : 'Список ранее найденных ловушек пуст.');

      let contents: any;
      if (fileText) {
        contents = `${langDirective}\n${
          lang === 'en'
            ? `Previously identified traps:\n${trapsSummary}\n\nRevised contract version:\n${fileText}`
            : `Ранее найденные ловушки:\n${trapsSummary}\n\nНовая версия договора:\n${fileText}`
        }`;
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
              text: `${langDirective}\n${
                lang === 'en'
                  ? `Previously identified traps:\n${trapsSummary}\n\nCompare revised contract against list according to system instruction.`
                  : `Ранее найденные ловушки:\n${trapsSummary}\n\nСравни новую версию договора со списком согласно системной инструкции.`
              }`,
            },
          ],
        };
      }

      const responseText = await callGeminiOptimized(ai, {
        systemInstruction: `${getSystemInstructionRecheck(lang)}\n\n${langDirective}`,
        contents,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
      });

      let parsed: any;
      try {
        const cleaned = cleanJsonString(responseText);
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Failed to parse recheck JSON:', parseErr, responseText);
        return res.status(500).json({
          error: lang === 'en' ? 'Model response was received in an invalid format. Please retry.' : 'Ответ модели поступил в неверном формате. Попробуйте повторить запрос.',
        });
      }

      const comparison = Array.isArray(parsed.сравнение) ? parsed.сравнение : [];
      const newTrapsRaw = Array.isArray(parsed.новые_ловушки) ? parsed.новые_ловушки : [];

      const normalizedNewTraps = newTrapsRaw.map((t: any, idx: number) => ({
        пункт: t.пункт || `${lang === 'en' ? 'New clause #' : 'Новый №'}${idx + 1}`,
        цитата: t.цитата || '',
        опасность: t.опасность || t.чем_опасно || '',
        чем_опасно: t.опасность || t.чем_опасно || '',
        просить: t.просить || t.что_просить || '',
        что_просить: t.просить || t.что_просить || '',
        уровень: normalizeItemLevel(t.уровень, lang),
      }));

      // Calculate progress: "Устранено X из N"
      const totalCount = Array.isArray(previousTraps) && previousTraps.length > 0
        ? previousTraps.length
        : comparison.length;

      const eliminatedCount = comparison.filter((c: any) => {
        const st = normalizeStatus(c.статус, lang);
        return st === 'устранена' || st === 'resolved';
      }).length;

      const remainingTraps = [
        ...comparison.filter((c: any) => {
          const st = normalizeStatus(c.статус, lang);
          return st !== 'устранена' && st !== 'resolved';
        }).map((c: any) => {
          const st = normalizeStatus(c.статус, lang);
          const isMod = st === 'изменена' || st === 'modified';
          const prefix = lang === 'en'
            ? (isMod ? 'Clause modified: ' : 'Clause remained: ')
            : (isMod ? 'Условие изменено: ' : 'Условие осталось: ');
          const defaultReq = lang === 'en' ? 'Review clause wording' : 'Проверить формулировку';
          return {
            пункт: c.пункт || '',
            цитата: '',
            опасность: `${prefix}${c.почему || ''}`,
            чем_опасно: `${prefix}${c.почему || ''}`,
            просить: defaultReq,
            что_просить: defaultReq,
            уровень: isMod ? normalizeItemLevel('средний', lang) : normalizeItemLevel('высокий', lang),
          };
        }),
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
      let riskLevel: 'низкий' | 'средний' | 'высокий' | 'low' | 'medium' | 'high' = normalizeRiskLevel(parsed.риск, lang);
      if (!parsed.риск) {
        if (remainingTraps.some((t: any) => t.уровень === 'высокий' || t.уровень === 'high')) {
          riskLevel = lang === 'ru' ? 'высокий' : 'high';
        } else if (remainingTraps.length > 0) {
          riskLevel = lang === 'ru' ? 'средний' : 'medium';
        } else {
          riskLevel = lang === 'ru' ? 'низкий' : 'low';
        }
      }

      return res.status(200).json({
        риск: riskLevel,
        общий_уровень_риска: riskLevel,
        сравнение: comparison.map((c: any) => ({
          пункт: c.пункт || '',
          статус: normalizeStatus(c.статус, lang),
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
          error: lang === 'en' ? 'No identified traps provided to draft the letter.' : 'Для составления письма не переданы выявленные ловушки.',
        });
      }

      // Send ONLY found traps (no full contract text)
      const trapsSummary = traps.slice(0, 5).map((t: any, index: number) => {
        const itemNumber = t.пункт || `${lang === 'en' ? 'Clause #' : '№'}${index + 1}`;
        const danger = t.опасность || t.чем_опасно || (lang === 'en' ? 'Unfavorable term' : 'Рискованное условие');
        const request = t.просить || t.что_просить || (lang === 'en' ? 'Revise wording to fair parity' : 'Изменить формулировку на паритетную');
        return `${index + 1}. ${itemNumber}: ${danger}. ${lang === 'en' ? 'Proposal' : 'Просьба'}: ${request}`;
      }).join('\n');

      const prompt = `${langDirective}\n${
        lang === 'en'
          ? `List of contract terms to modify:\n${trapsSummary}\n\nWrite a polite business letter according to system instruction.`
          : `Список условий для изменения в договоре:\n${trapsSummary}\n\nНапиши вежливое деловое письмо согласно системной инструкции.`
      }`;

      const letterText = await callGeminiOptimized(ai, {
        systemInstruction: `${getSystemInstructionLetter(lang)}\n\n${langDirective}`,
        contents: prompt,
        maxOutputTokens: 350,
      });

      return res.status(200).json({ letter: letterText.trim() });

    } else {
      return res.status(400).json({
        error: lang === 'ru'
          ? `Неизвестное действие: ${action}. Ожидалось "check_traps", "recheck_agreed" или "generate_letter".`
          : `Unknown action: ${action}. Expected "check_traps", "recheck_agreed", or "generate_letter".`,
      });
    }

  } catch (error: any) {
    console.error('API /api/analyze error:', error);
    const friendlyMessage = formatFriendlyError(error, lang);
    return res.status(500).json({
      error: friendlyMessage,
    });
  }
}

// Export default for Vercel Serverless Function compatibility
export default async function handler(req: any, res: any) {
  return handleAnalyzeRequest(req, res);
}
