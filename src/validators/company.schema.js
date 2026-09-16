import { z } from 'zod';

const url = z.string().url();

export const createCompanySchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must use lowercase letters, numbers, and hyphens.'
    ),
  website: url,
  careersUrl: url,
  logoUrl: url.optional(),
  industry: z.string().trim().max(120).optional(),
  companyType: z.string().trim().max(120).optional(),
  headquarters: z
    .object({
      city: z.string().trim().max(120).optional(),
      state: z.string().trim().max(120).optional(),
      country: z.string().trim().max(120).default('India'),
    })
    .optional(),
  country: z.string().trim().max(120).default('India'),
  isActive: z.boolean().optional(),
});
