import { z } from "zod";

/**
 * Shared validations
 */
const emailSchema = z.string().email("Invalid email format");
const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters long");

/**
 * Register validation
 */
export const registerSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(50, "Name cannot exceed 50 characters"),
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Login validation
 */
export const loginUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * OPTIONAL — Add future schemas:
 *
 * export const updateProfileSchema = z.object({
 *   name: z.string().min(3),
 * });
 *
 * export const changePasswordSchema = z.object({
 *   oldPassword: passwordSchema,
 *   newPassword: passwordSchema,
 * });
 *
 */
