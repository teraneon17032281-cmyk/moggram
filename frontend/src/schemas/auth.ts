import { z } from 'zod';

const email = z.string().trim().min(1, 'Enter your email').email('Enter a valid email address');
const iucaEmail = email.refine((value) => value.toLowerCase().endsWith('@iuca.kg'), 'Use your university email ending in @iuca.kg');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(60, 'Name is too long'),
    email: iucaEmail,
    username: z
      .string()
      .trim()
      .min(3, 'Username needs at least 3 characters')
      .max(20, 'Username can be at most 20 characters')
      .regex(/^[a-zA-Z0-9_.]+$/, 'Use only letters, numbers, dots and underscores'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[a-z]/, 'Add a lowercase letter')
      .regex(/[A-Z]/, 'Add an uppercase letter')
      .regex(/\d/, 'Add a number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    terms: z.boolean().refine((v) => v, 'Accept the Terms and Privacy Policy to continue'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[a-z]/, 'Add a lowercase letter')
      .regex(/[A-Z]/, 'Add an uppercase letter')
      .regex(/\d/, 'Add a number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export const emailOnlySchema = z.object({ email });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
export type EmailOnlyValues = z.infer<typeof emailOnlySchema>;

export const CODE_LENGTH = 6;
export const isValidCode = (code: string) => new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);

/** 0 (empty) to 4 (strong) */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) s++;
  return s;
}
