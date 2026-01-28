import { extractTextFromFile } from '../utils/fileParser.js';
// Import BOTH services
import { analyzeForCandidate } from '../services/ai.candidate.service.js';
import { analyzeForRecruiter } from '../services/ai.recruiter.service.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import { getRedisClient } from '../config/redis.js';

// ... imports
export const analyze = async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, 'Please upload a resume file.');

    const rawText = await extractTextFromFile(req.file.buffer, req.file.mimetype);
    const jobDescription = req.body.jobDescription || null;
    const userRole = req.user.role;

    let analysisResult;

    if (userRole === 'recruiter') {
      analysisResult = await analyzeForRecruiter(rawText, null, jobDescription);
    } else {
      analysisResult = await analyzeForCandidate(rawText, null, jobDescription);

      const user = await User.findById(req.user._id);
      user.coins = Math.max(0, user.coins - req.coinCost);
      user.coinHistory.push({
        type: 'deduct',
        coins: req.coinCost,
        description: `Premium AI Resume Analysis`,
        createdAt: new Date(),
      });
      await user.save();

      const redis = getRedisClient();
      await redis.del(`user:${user._id}`);
    }

    res.status(200).json({ success: true, data: analysisResult });
  } catch (error) {
    next(error);
  }
};
