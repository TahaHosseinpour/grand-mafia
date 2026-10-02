import { z, zEmail, zOptional } from '@/lib/validation';

/**
 * Auth input schemas. Limits and messages mirror the legacy sign-up form
 * (legacy/routes/accounts.js): usernames are 3–16 Latin letters/digits,
 * passwords 6–255 characters.
 */

export const zUsername = z
  .string('نام کاربری الزامی است')
  .trim()
  .min(1, 'نام کاربری الزامی است')
  .regex(/^[a-z0-9]+$/i, 'نام کاربری فقط می‌تواند شامل حروف انگلیسی و عدد باشد.')
  .min(3, 'نام کاربری شما خیلی کوتاه است.')
  .max(16, 'نام کاربری شما خیلی طولانی است.');

export const zNewPassword = z
  .string('رمز عبور الزامی است')
  .min(6, 'رمز عبور شما خیلی کوتاه است.')
  .max(255, 'رمز عبور شما خیلی طولانی است.');

export const signUpInput = z
  .object({
    username: zUsername,
    password: zNewPassword,
    password2: z.string('تکرار رمز عبور الزامی است'),
    email: zOptional(zEmail),
    isPrivate: z.boolean().default(false),
    touAgree: z.literal(true, 'باید قوانین استفاده را بپذیرید.'),
  })
  .refine((data) => data.password === data.password2, {
    message: 'رمزهای عبور یکسان نیستند.',
    path: ['password2'],
  });
export type SignUpInput = z.input<typeof signUpInput>;

export const signInInput = z.object({
  username: z.string('نام کاربری الزامی است').trim().min(1, 'نام کاربری الزامی است').max(16, 'نام کاربری یافت نشد'),
  password: z.string('رمز عبور الزامی است').min(1, 'رمز عبور الزامی است').max(255),
});
export type SignInInput = z.input<typeof signInInput>;

export const requestPasswordResetInput = z.object({
  email: zEmail,
});

export const resetPasswordInput = z
  .object({
    username: zUsername,
    token: z.string().regex(/^[a-f0-9]{64}$/, 'لینک نامعتبر است'),
    password: zNewPassword,
    password2: z.string('تکرار رمز عبور الزامی است'),
  })
  .refine((data) => data.password === data.password2, {
    message: 'رمزهای عبور یکسان نیستند.',
    path: ['password2'],
  });

export const verifyEmailInput = z.object({
  username: zUsername,
  token: z.string().regex(/^[a-f0-9]{64}$/, 'لینک نامعتبر است'),
});

export const changePasswordInput = z
  .object({
    newPassword: zNewPassword,
    newPasswordConfirm: z.string('تکرار رمز عبور الزامی است'),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: 'رمزهای عبور یکسان نیستند.',
    path: ['newPasswordConfirm'],
  });

/** An empty email clears it. */
export const changeEmailInput = z.object({
  email: zOptional(zEmail),
});

export const deleteAccountInput = z.object({
  password: z.string('رمز عبور الزامی است').min(1, 'رمز عبور الزامی است').max(255),
});
