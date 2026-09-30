import { z } from 'zod';

export const recommendationFeedbackSchema = z.object({
  feedback: z.enum(['relevant', 'not_relevant', 'applied', 'interview', 'offer']),
});
