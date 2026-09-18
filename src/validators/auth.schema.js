import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128);

const TECH_TRACKS = [
  'software',
  'ai-ml',
  'data',
  'cloud-infra',
  'mobile',
  'security',
  'qa',
  'systems',
  'eng-management',
];

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email,
  password,
  turnstileToken: z.string().min(1).max(2048).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  turnstileToken: z.string().min(1).max(2048).optional(),
});

export const googleSchema = z.object({
  idToken: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1).max(256),
});

export const forgotPasswordSchema = z.object({
  email,
  turnstileToken: z.string().min(1).max(2048).optional(),
});

export const resendVerifySchema = z.object({
  email,
  turnstileToken: z.string().min(1).max(2048).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(256),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});

const skillsList = z.array(z.string().trim().min(1).max(60)).max(10).optional();

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    avatarUrl: z.string().trim().url().max(2048).optional(),
    headline: z.string().trim().max(160).optional(),
    currentRole: z.string().trim().max(120).optional(),
    techTrack: z.enum(TECH_TRACKS).optional(),
    techRoles: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    skills: skillsList,
    city: z.string().trim().max(120).optional(),
    experienceYears: z.number().min(0).max(60).optional(),
    remoteType: z.enum(['onsite', 'hybrid', 'remote', 'unknown']).optional(),
  })
  .strict();
