import crypto from 'node:crypto';

import nodemailer from 'nodemailer';

import { getRedisClient } from '../config/redis.js';

const VERIFY_TTL_SECONDS = 24 * 60 * 60;
const RESET_TTL_SECONDS = 60 * 60;
const MAGIC_TTL_SECONDS = 15 * 60;

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporter;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const storeToken = async (prefix, token, userId, ttlSeconds) => {
  const redis = getRedisClient();
  await redis.set(`${prefix}:${hashToken(token)}`, String(userId), 'EX', ttlSeconds);
};

const consumeToken = async (prefix, token) => {
  const key = `${prefix}:${hashToken(token)}`;
  try {
    const redis = getRedisClient();
    const userId = await redis.get(key);
    if (userId) await redis.del(key);
    return userId;
  } catch {
    return null;
  }
};

export const issueVerifyToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  try {
    await storeToken('verify', token, userId, VERIFY_TTL_SECONDS);
  } catch {
    // Redis down — email links cannot be validated; caller still continues.
  }
  return token;
};

export const issueResetToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  try {
    await storeToken('reset', token, userId, RESET_TTL_SECONDS);
  } catch {
    // Best effort.
  }
  return token;
};

export const consumeVerifyToken = (token) => consumeToken('verify', token);
export const consumeResetToken = (token) => consumeToken('reset', token);

export const issueMagicToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  try {
    await storeToken('magic', token, userId, MAGIC_TTL_SECONDS);
  } catch {
    // Redis down — magic links cannot be validated; caller still continues.
  }
  return token;
};

export const consumeMagicToken = (token) => consumeToken('magic', token);

const frontendUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const sendMail = async ({ to, subject, html }) => {
  const tx = getTransporter();
  if (!tx) {
    console.log(`📧 [dev] email to ${to}: ${subject}`);
    return { delivered: false };
  }
  await tx.sendMail({
    from: process.env.SMTP_FROM || 'ReerHub <noreply@reerhub.com>',
    to,
    subject,
    html,
  });
  return { delivered: true };
};

export const sendVerifyEmail = async ({ to, token }) => {
  const url = `${frontendUrl()}/verify-email?token=${token}`;
  return sendMail({
    to,
    subject: 'Verify your ReerHub email',
    html: `<p>Welcome to ReerHub! Confirm your email:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`,
  });
};

export const sendResetEmail = async ({ to, token }) => {
  const url = `${frontendUrl()}/reset-password?token=${token}`;
  return sendMail({
    to,
    subject: 'Reset your ReerHub password',
    html: `<p>Reset your password:</p><p><a href="${url}">${url}</a></p><p>This link expires in 1 hour. If you did not request it, ignore this email.</p>`,
  });
};

export const sendMagicEmail = async ({ to, token }) => {
  const url = `${frontendUrl()}/verify-magic?token=${token}`;
  return sendMail({
    to,
    subject: 'Sign in to ReerHub',
    html: `<p>Sign in to ReerHub:</p><p><a href="${url}">${url}</a></p><p>This link expires in 15 minutes and can be used once. If you did not request it, ignore this email.</p>`,
  });
};
