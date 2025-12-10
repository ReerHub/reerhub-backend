import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';

export const checkAndReserveCoins = async (req, res, next) => {
  try {
    const { models } = req.body;
    let selected = [];

    try {
      selected = JSON.parse(models);
    } catch {
      if (typeof models === 'string') selected = models.split(',');
    }

    if (!Array.isArray(selected) || selected.length === 0) {
      throw new ApiError(400, 'No AI models selected.');
    }

    // Dynamic pricing → 1 coin per model
    const cost = selected.length * 1;

    const user = await User.findById(req.user._id);

    if (!user) throw new ApiError(404, 'User not found');

    if (user.coins < cost) {
      throw new ApiError(402, 'Not enough coins. Please buy coins.');
    }

    // Store for deduction AFTER AI success
    req.coinCost = cost;
    req.selectedModels = selected;

    next();
  } catch (err) {
    next(err);
  }
};
