import { extractTextFromFile } from '../utils/fileParser.js';
// Import BOTH services
import { analyzeForCandidate } from '../services/ai.candidate.service.js';
import { analyzeForRecruiter } from '../services/ai.recruiter.service.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import { getRedisClient } from '../config/redis.js';

export const analyze = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please upload a resume file (PDF or DOCX).');
    }

    // 1. Extract Text
    const rawText = await extractTextFromFile(req.file.buffer, req.file.mimetype);
    if (!rawText || rawText.trim().length === 0) {
      throw new ApiError(400, 'Unable to read text from file.');
    }

    // 2. Parse Inputs
    let selectedModels = [];
    if (req.body.models) {
      try {
        selectedModels = JSON.parse(req.body.models);
      } catch {
        if (typeof req.body.models === 'string')
          selectedModels = req.body.models.split(',');
      }
    }
    const jobDescription = req.body.jobDescription || null;

    // 3. ROLE-BASED ROUTING
    const userRole = req.user.role; // Set by authMiddleware

    let analysisResult;

    if (userRole === 'recruiter') {
      // Route to Recruiter Brain (Critical, Objective)
      analysisResult = await analyzeForRecruiter(rawText, selectedModels, jobDescription);
    } else {
      // Route to Candidate Brain (Mentoring, Kind) - Default
      analysisResult = await analyzeForCandidate(rawText, selectedModels, jobDescription);
      // ONLY deduct coins if AI analysis succeeds
      const user = await User.findById(req.user._id);
      user.coins = Math.max(0, user.coins - req.coinCost);

      user.coinHistory.push({
        type: 'deduct',
        coins: req.coinCost,
        description: `Resume analysis using ${selectedModels.length} model(s)`,
        createdAt: new Date(),
      });

      await user.save();

      // Clear cache after deduction
      const redis = getRedisClient();
      await redis.del(`user:${user._id}`);
    }

    res.status(200).json({
      success: true,
      message: 'Analysis complete',
      data: analysisResult,
    });
  } catch (error) {
    next(error);
  }
};
