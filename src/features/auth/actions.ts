'use server';

import { defineAction } from '@/server/action';
import {
  changeEmail,
  changePassword,
  deleteAccount,
  requestPasswordReset,
  requestVerification,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from './dal';
import {
  changeEmailInput,
  changePasswordInput,
  deleteAccountInput,
  requestPasswordResetInput,
  resetPasswordInput,
  signInInput,
  signUpInput,
} from './inputs';

export const signUpAction = defineAction({
  name: 'auth.signUp',
  auth: 'none',
  rateLimit: 'REGISTER',
  input: signUpInput,
  handler: (input) => signUp(input),
});

export const signInAction = defineAction({
  name: 'auth.signIn',
  auth: 'none',
  rateLimit: 'LOGIN',
  input: signInInput,
  handler: (input) => signIn(input),
});

export const signOutAction = defineAction({
  name: 'auth.signOut',
  auth: 'none',
  handler: () => signOut(),
});

export const requestPasswordResetAction = defineAction({
  name: 'auth.requestPasswordReset',
  auth: 'none',
  rateLimit: 'PASSWORD_RESET',
  input: requestPasswordResetInput,
  handler: (input) => requestPasswordReset(input),
});

export const resetPasswordAction = defineAction({
  name: 'auth.resetPassword',
  auth: 'none',
  rateLimit: 'PASSWORD_RESET',
  input: resetPasswordInput,
  handler: (input) => resetPassword(input),
});

export const requestVerificationAction = defineAction({
  name: 'auth.requestVerification',
  rateLimit: 'SEND_VERIFICATION',
  handler: () => requestVerification(),
});

export const changePasswordAction = defineAction({
  name: 'auth.changePassword',
  rateLimit: 'PASSWORD_CHANGE',
  input: changePasswordInput,
  handler: (input) => changePassword(input),
});

export const changeEmailAction = defineAction({
  name: 'auth.changeEmail',
  rateLimit: 'SEND_VERIFICATION',
  input: changeEmailInput,
  handler: (input) => changeEmail(input),
});

export const deleteAccountAction = defineAction({
  name: 'auth.deleteAccount',
  rateLimit: 'PASSWORD_CHANGE',
  input: deleteAccountInput,
  handler: (input) => deleteAccount(input),
});
