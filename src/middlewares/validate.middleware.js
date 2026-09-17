/**
 * Validate request body using Zod schema. mongo-sanitize is already applied
 * globally in config/security.js, so it is NOT repeated here.
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        field: issue.path?.join('.') || 'unknown',
        message: issue.message,
      }));

      return res.status(400).json({
        message: errors[0]?.message || 'Validation failed',
        errors,
      });
    }

    req.validated = parsed.data; // Attach validated data
    next();
  } catch (err) {
    console.error('Validation middleware error:', err);
    return res.status(500).json({
      message: 'Validation processing failed',
    });
  }
};
