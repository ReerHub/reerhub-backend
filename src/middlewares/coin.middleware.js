import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';

export const checkAndReserveCoins = async (req, res, next) => {
  try {
    const FIXED_COST = 10;
    const user = await User.findById(req.user._id);

    if (!user) throw new ApiError(404, 'User not found');

    if (user.coins < FIXED_COST) {
      throw new ApiError(402, `This premium analysis requires ${FIXED_COST} coins.`);
    }

    req.coinCost = FIXED_COST;
    next();
  } catch (err) {
    next(err);
  }
};
