import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'; // Use legacy build for Node compatibility
import ApiError from './ApiError.js';

/**
 * Extracts raw text from a file buffer
 */
export const extractTextFromFile = async (fileBuffer, mimetype) => {
  try {
    // --- 1. Handle PDF (Mozilla PDF.js) ---
    if (mimetype === 'application/pdf') {
      // Convert Node Buffer to Uint8Array (required by PDF.js)
      const uint8Array = new Uint8Array(fileBuffer);

      // Load the document
      const loadingTask = pdfjsLib.getDocument(uint8Array);
      const pdfDocument = await loadingTask.promise;

      let fullText = '';

      // Loop through every page to extract text
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();

        // Combine text items (lines) into a single string
        const pageText = textContent.items.map((item) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      return fullText;
    }

    // --- 2. Handle DOCX ---
    if (
      mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }

    // --- 3. Handle Plain Text ---
    if (mimetype === 'text/plain') {
      return fileBuffer.toString('utf-8');
    }

    throw new ApiError(400, 'Unsupported file type. Please upload PDF or DOCX.');
  } catch (error) {
    console.error('File Parsing Error:', error);

    if (error instanceof ApiError) throw error;

    throw new ApiError(
      500,
      'Failed to process file. It might be encrypted or corrupted.'
    );
  }
};
