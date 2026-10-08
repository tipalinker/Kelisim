/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore
import mammoth from 'mammoth';

export interface ExtractedFilePayload {
  fileText?: string;
  fileBase64?: string;
  mimeType: string;
  fileName: string;
  isExtractedText: boolean;
}

/**
 * Extract text from PDF in the browser using pdfjs-dist
 */
async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');

  // Configure worker
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText) {
      fullText += `[Стр. ${pageNum}] ${pageText}\n\n`;
    }
  }

  return fullText.trim();
}

/**
 * Extract raw text from DOCX in the browser using mammoth
 */
async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result?.value || '').trim();
}

/**
 * Resize PNG or JPG image to max width (around 1200px) to conserve tokens
 */
export async function resizeImageForAnalysis(
  file: File,
  maxWidth = 1200
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Не удалось подготовить изображение для обработки.'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG compression at 0.82 to save tokens and bytes
      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, 0.82);
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ base64, mimeType });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось открыть изображение договора.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Prepares file for analysis:
 * - For PDF, DOCX, TXT: extracts plain text directly in the browser and returns text.
 * - For PNG, JPG: resizes image to max width 1200px.
 * - If text cannot be extracted: throws a clear Russian error message.
 */
export async function prepareFileForAnalysis(file: File): Promise<ExtractedFilePayload> {
  const lowerName = file.name.toLowerCase();
  const mimeType = file.type || '';

  const isTxt = lowerName.endsWith('.txt') || mimeType === 'text/plain';
  const isDocx = lowerName.endsWith('.docx') || mimeType.includes('wordprocessingml') || mimeType.includes('docx');
  const isPdf = lowerName.endsWith('.pdf') || mimeType.includes('pdf');
  const isImage = (mimeType && mimeType.startsWith('image/')) || /\.(png|jpe?g|webp)$/i.test(lowerName);

  if (isTxt) {
    try {
      const text = await file.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Файл TXT пуст. Пожалуйста, загрузите договор с текстом.');
      }
      return {
        fileText: text.trim(),
        mimeType: 'text/plain',
        fileName: file.name,
        isExtractedText: true,
      };
    } catch (err: any) {
      throw new Error(err?.message || 'Не удалось прочитать текстовый файл.');
    }
  }

  if (isDocx) {
    let text = '';
    try {
      text = await extractTextFromDocx(file);
    } catch (err) {
      console.error('Failed to parse docx in browser:', err);
    }

    if (!text || text.trim().length === 0) {
      throw new Error(
        'Не удалось извлечь текст из файла DOCX. Убедитесь, что файл содержит текст договора и не повреждён.'
      );
    }

    return {
      fileText: text,
      mimeType: 'text/plain',
      fileName: file.name,
      isExtractedText: true,
    };
  }

  if (isPdf) {
    let text = '';
    try {
      text = await extractTextFromPdf(file);
    } catch (err) {
      console.error('Failed to parse PDF in browser:', err);
    }

    if (!text || text.trim().length < 15) {
      throw new Error(
        'В файле PDF не найден текстовый слой (возможно, это отсканированное изображение или защищённый PDF). Для экономии токенов загрузите файл в формате DOCX, TXT или фото страниц договора (PNG/JPG).'
      );
    }

    return {
      fileText: text,
      mimeType: 'text/plain',
      fileName: file.name,
      isExtractedText: true,
    };
  }

  if (isImage) {
    try {
      const { base64, mimeType: compressedMime } = await resizeImageForAnalysis(file, 1200);
      return {
        fileBase64: base64,
        mimeType: compressedMime,
        fileName: file.name,
        isExtractedText: false,
      };
    } catch (err: any) {
      throw new Error(err?.message || 'Не удалось подготовить изображение договора.');
    }
  }

  throw new Error('Неподдерживаемый формат файла. Поддерживаются PDF, DOCX, TXT, PNG, JPG.');
}
