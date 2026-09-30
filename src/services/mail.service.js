import crypto from 'node:crypto';

import nodemailer from 'nodemailer';

import AuthToken from '../models/authToken.model.js';

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
  await AuthToken.deleteMany({ userId, type: prefix, usedAt: { $exists: false } });
  await AuthToken.create({
    userId,
    type: prefix,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });
};

const consumeToken = async (prefix, token) => {
  const record = await AuthToken.findOneAndUpdate(
    {
      type: prefix,
      tokenHash: hashToken(token),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return record ? String(record.userId) : null;
};

export const issueVerifyToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  await storeToken('verify', token, userId, VERIFY_TTL_SECONDS);
  return token;
};

export const issueResetToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  await storeToken('reset', token, userId, RESET_TTL_SECONDS);
  return token;
};

export const consumeVerifyToken = (token) => consumeToken('verify', token);
export const consumeResetToken = (token) => consumeToken('reset', token);

export const issueMagicToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  await storeToken('magic', token, userId, MAGIC_TTL_SECONDS);
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

export const sendMatchDigest = async ({ to, name, recommendations }) => {
  const rows = recommendations
    .map(
      ({ job, fit }) =>
        `<li><strong>${job.title}</strong> at ${job.companyId?.name || 'a company'} — ${fit.score}% fit<br/><small>${fit.reasons.join(' · ')}</small><br/><a href="${frontendUrl()}/jobs/${job._id}">View role</a></li>`
    )
    .join('');
  return sendMail({
    to,
    subject: `Your ReerHub matches: ${recommendations.length} fresh roles`,
    html: `<p>Hi ${name}, here are your highest-fit official tech roles today.</p><ol>${rows}</ol><p><a href="${frontendUrl()}/dashboard">See all matches</a> · <a href="${frontendUrl()}/profile">Manage alerts</a></p>`,
  });
};
