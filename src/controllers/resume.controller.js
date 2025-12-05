import { extractTextFromFile } from '../utils/fileParser.js';
import { analyzeResume } from '../services/ai.service.js';
import ApiError from '../utils/ApiError.js';

export const analyze = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please upload a resume file (PDF or DOCX).');
    }

    // 1. Extract Text
    const rawText = await extractTextFromFile(req.file.buffer, req.file.mimetype);

    if (!rawText || rawText.trim().length === 0) {
      throw new ApiError(
        400,
        'Unable to read text from this file. It might be an image-only PDF.'
      );
    }

    // 2. Parse Selected Models from FormData
    // FormData sends arrays as 'models[]' or JSON strings. Let's handle JSON string safely.
    let selectedModels = [];
    if (req.body.models) {
      try {
        selectedModels = JSON.parse(req.body.models);
      } catch {
        // If it's not JSON, maybe it's just a single string or already an object?
        // Fallback: split by comma if simple string
        if (typeof req.body.models === 'string') {
          selectedModels = req.body.models.split(',');
        }
      }
    }

    // 3. Send to AI Service
    const analysisResult = await analyzeResume(rawText, selectedModels);

    res.status(200).json({
      success: true,
      message: 'Resume analyzed successfully',
      data: analysisResult,
    });
  } catch (error) {
    next(error);
  }
};
