import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { setToken, setUnauthorizedHandler } from '../api/client';
import type { Abilities, User, UserType } from '../api/types';

const TOKEN_KEY = 'ronda.token';
const USER_KEY = 'ronda.user';
const INTRO_KEY = 'ronda.locationIntroSeen';

export type Role = 'rep' | 'manager';

/** Mirrors User::ABILITIES on the server: who may do what, by user type. */
const ABILITY_TYPES: Record<keyof Omit<Abilities, 'can_assign_subscribers'>, UserType[]> = {
  dashboard: [0, 1, 2],
  view_lead: [0, 1, 2],
  create_lead: [0, 1, 2],
  edit_lead: [0, 1, 2],
  manage_task: [0, 1, 2],
  add_task: [0, 1, 2],
  create_task: [0, 1],
  ife_report: [0, 1, 2],
  manage_ife_report: [0, 1],
  manage_user: [0],
  form_creation: [0],
  form_admin: [0],
  manage_product: [0],
  manage_area: [0],
  record_order: [0, 1, 2],
  manage_order: [0, 1],
};

export function abilitiesFor(type: UserType): Abilities {
  const out = {} as Abilities;
  for (const [key, types] of Object.entries(ABILITY_TYPES)) {
    (out as unknown as Record<string, boolean>)[key] = types.includes(type);
  }
  out.can_assign_subscribers = out.create_task;
  return out;
}

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  role: Role;
  abilities: Abilities;
  /** True until the person has seen the location stamp explanation once. */
  needsLocationIntro: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Clear the session without calling the server (account deleted, token revoked). */
  forget: () => Promise<void>;
  finishLocationIntro: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [needsLocationIntro, setNeedsLocationIntro] = useState(false);
  const signingOut = useRef(false);

  const forget = useCallback(async () => {
    setToken(null);
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
      SecureStore.deleteItemAsync(USER_KEY).catch(() => {}),
    ]);
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!signingOut.current) forget();
    });
    (async () => {
      try {
        const [token, savedUser, introSeen] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
          AsyncStorage.getItem(INTRO_KEY),
        ]);
        setNeedsLocationIntro(introSeen !== '1');
        if (token && savedUser) {
          setToken(token);
          setUser(JSON.parse(savedUser) as User);
          setStatus('signedIn');
          return;
        }
      } catch {
        // A damaged store just means signing in again.
      }
      setStatus('signedOut');
    })();
  }, [forget]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email.trim(), password);
    setToken(result.token);
    await SecureStore.setItemAsync(TOKEN_KEY, result.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(slimUser(result.user)));
    setUser(result.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      await authApi.logout();
    } catch {
      // The token is dropped on the phone either way.
    } finally {
      signingOut.current = false;
      await forget();
    }
  }, [forget]);

  const finishLocationIntro = useCallback(() => {
    setNeedsLocationIntro(false);
    AsyncStorage.setItem(INTRO_KEY, '1').catch(() => {});
  }, []);

  const value = useMemo<AuthState>(() => {
    const type = (user?.type ?? 2) as UserType;
    return {
      status,
      user,
      // Admins use the manager app; admin-only tools stay on the web.
      role: type === 2 ? 'rep' : 'manager',
      abilities: abilitiesFor(type),
      needsLocationIntro,
      signIn,
      signOut,
      forget,
      finishLocationIntro,
    };
  }, [status, user, needsLocationIntro, signIn, signOut, forget, finishLocationIntro]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Keep only what the app needs; SecureStore values should stay small. */
function slimUser(u: User): User {
  return { id: u.id, name: u.name, email: u.email, mobile: u.mobile ?? null, type: u.type, username: u.username ?? null };
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
