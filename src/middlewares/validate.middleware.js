import sanitize from "mongo-sanitize";

/**
 * Validate request body using Zod schema
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const sanitized = sanitize(req.body);
    const parsed = schema.safeParse(sanitized);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        field: issue.path?.join(".") || "unknown",
        message: issue.message,
      }));

      return res.status(400).json({
        message: errors[0]?.message || "Validation failed",
        errors,
      });
    }

    req.validated = parsed.data; // Attach validated & sanitized data
    next();
  } catch (err) {
    console.error("Validation middleware error:", err);
    return res.status(500).json({
      message: "Validation processing failed",
    });
  }
};
