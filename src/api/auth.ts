import { api, ApiError } from './client';
import type { Abilities, LoginResult, User, VersionInfo } from './types';

export async function login(email: string, password: string): Promise<LoginResult> {
  const body = await api.post<{ message?: string; data?: { token?: string; user?: User } }>('login', { email, password });
  // A wrong password still answers 200 "ok", only without a token.
  if (!body.data?.token || !body.data.user) {
    const blocked = /blocked/i.test(body.message ?? '');
    throw new ApiError(
      blocked
        ? 'Your account is turned off. Check with your manager.'
        : 'That email and password do not match. Check them and try again.',
      400,
    );
  }
  return { token: body.data.token, user: body.data.user };
}

export async function logout(): Promise<void> {
  await api.post('logout');
}

export async function sendResetLink(email: string): Promise<string> {
  const body = await api.post<{ message?: string }>('password/forgot', { email });
  return body.message ?? 'We sent you a link to reset your password.';
}

export async function fetchVersion(): Promise<VersionInfo> {
  const body = await api.get<VersionInfo>('version');
  return { life_version: body.life_version ?? null, min_version: body.min_version ?? null };
}

export async function requestAccountDeletion(reason?: string): Promise<void> {
  await api.post('account/delete', { reason: reason || null });
}

export async function updatePushToken(fcmToken: string): Promise<void> {
  await api.post('updateFCMToken', { fcm_token: fcmToken });
}

/** The ability map comes with the home summary (listOfPermissions). */
export type { Abilities };
