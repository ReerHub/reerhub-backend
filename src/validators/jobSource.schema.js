import { z } from 'zod';

export const createJobSourceSchema = z.object({
  companyId: z.string().regex(/^[a-f\d]{24}$/i, 'A valid company ID is required.'),
  type: z.enum(['greenhouse', 'ashby', 'lever', 'smartrecruiters', 'custom']),
  name: z.string().trim().min(1).max(160),
  careersUrl: z.string().url(),
  config: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});
