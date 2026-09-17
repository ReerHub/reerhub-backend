import bcrypt from 'bcryptjs';

export const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password, passwordHash) => {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
};
