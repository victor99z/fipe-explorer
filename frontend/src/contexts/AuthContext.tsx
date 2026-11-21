import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type PocketBase from 'pocketbase';
import {
  fetchUserCurationMap,
  getPocketBaseClient,
  loadLocalCarPrefs,
  PB_CAR_COLLECTIONS,
  type LocalCarPrefsMap,
} from '../services/pocketbase';
import { fetchUnreadAlertNotificationsCount } from '../services/alerts';

export interface AuthUser {
  id: string;
  /** ID inside `users` collection used for relation fields (`car_alerts`, `user_car_curation`) */
  profileUserId: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isSuperuser: boolean;
  alertsEnabled: boolean;
}

interface AuthContextValue {
  pb: PocketBase;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  unreadAlertsCount: number;
  curationMap: LocalCarPrefsMap;
  setCurationMap: React.Dispatch<React.SetStateAction<LocalCarPrefsMap>>;
  refreshCuration: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateProfile: (patch: { name?: string; alerts_enabled?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extractAuthUser(
  record: Record<string, unknown> | null | undefined,
  linkedUserId?: string,
): AuthUser | null {
  if (!record || !record.id) return null;
  const colName = String(record.collectionName ?? '');
  const isSuperuser = colName === '_superusers' || colName === '_admins';
  const rawRole = String(record.role ?? '').toLowerCase();
  const role: 'admin' | 'user' = isSuperuser || rawRole === 'admin' ? 'admin' : 'user';
  const email = String(record.email ?? '');
  const name =
    String(record.name ?? '').trim() ||
    (isSuperuser ? 'Superusuário' : email.split('@')[0] || 'Usuário');

  return {
    id: String(record.id),
    profileUserId: isSuperuser ? linkedUserId || '' : String(record.id),
    email,
    name,
    role,
    isSuperuser,
    alertsEnabled: record.alerts_enabled !== false,
  };
}

async function resolveSuperuserProfileId(
  pb: PocketBase,
  email: string,
): Promise<string> {
  if (!email) return '';
  try {
    const existing = await pb
      .collection('users')
      .getFirstListItem<{ id: string }>(pb.filter('email = {:em}', { em: email }), {
        fields: 'id',
      });
    return existing.id;
  } catch {
    return '';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pb = useMemo(() => getPocketBaseClient(), []);
  const [user, setUser] = useState<AuthUser | null>(() =>
    pb.authStore.isValid
      ? extractAuthUser(pb.authStore.record as Record<string, unknown> | null)
      : null,
  );
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [curationMap, setCurationMap] = useState<LocalCarPrefsMap>(() =>
    loadLocalCarPrefs(),
  );

  // Sync authStore changes + resolve linked user id for superusers
  useEffect(() => {
    let active = true;

    async function syncFromStore() {
      if (!pb.authStore.isValid || !pb.authStore.record) {
        if (active) {
          setUser(null);
          setUnreadAlertsCount(0);
          setCurationMap(loadLocalCarPrefs());
        }
        return;
      }

      const raw = pb.authStore.record as Record<string, unknown>;
      const colName = String(raw.collectionName ?? '');
      let linkedId = '';
      if (colName === '_superusers' || colName === '_admins') {
        linkedId = await resolveSuperuserProfileId(pb, String(raw.email ?? ''));
      }
      if (!active) return;
      setUser(extractAuthUser(raw, linkedId));
    }

    void syncFromStore();
    const unsub = pb.authStore.onChange(() => {
      void syncFromStore();
    });

    return () => {
      active = false;
      unsub();
    };
  }, [pb]);

  const refreshUnreadCount = useCallback(async () => {
    const uid = user?.profileUserId;
    if (!uid) {
      setUnreadAlertsCount(0);
      return;
    }
    const count = await fetchUnreadAlertNotificationsCount(pb, uid);
    setUnreadAlertsCount(count);
  }, [pb, user?.profileUserId]);

  const refreshCuration = useCallback(async () => {
    const uid = user?.profileUserId;
    if (!uid) {
      setCurationMap(loadLocalCarPrefs());
      return;
    }
    const remoteMap = await fetchUserCurationMap(pb, uid);
    setCurationMap(remoteMap);
  }, [pb, user?.profileUserId]);

  useEffect(() => {
    void refreshUnreadCount();
    void refreshCuration();
  }, [refreshUnreadCount, refreshCuration]);

  // Realtime subscription to alert notifications for the logged-in user
  useEffect(() => {
    const uid = user?.profileUserId;
    if (!uid) return;

    let unsubscribeFn: (() => void) | null = null;
    let cancelled = false;

    pb.collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS)
      .subscribe('*', () => {
        if (!cancelled) {
          void refreshUnreadCount();
        }
      })
      .then((unsub) => {
        if (cancelled) {
          void unsub();
        } else {
          unsubscribeFn = () => {
            void unsub();
          };
        }
      })
      .catch(() => {
        // Ignore if realtime endpoint is disabled or collection missing
      });

    return () => {
      cancelled = true;
      if (unsubscribeFn) unsubscribeFn();
    };
  }, [pb, user?.profileUserId, refreshUnreadCount]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const cleanEmail = email.trim();
      let authErr: unknown;

      try {
        const res = await pb
          .collection('users')
          .authWithPassword(cleanEmail, password);
        const mapped = extractAuthUser(res.record as Record<string, unknown>);
        if (!mapped) throw new Error('Falha ao obter perfil do usuário.');
        setUser(mapped);
        return mapped;
      } catch (err) {
        authErr = err;
      }

      // Fallback for PocketBase _superusers configured directly on the server
      try {
        const res = await pb
          .collection('_superusers')
          .authWithPassword(cleanEmail, password);
        const raw = res.record as Record<string, unknown>;
        const linkedId = await resolveSuperuserProfileId(pb, cleanEmail);
        const mapped = extractAuthUser(raw, linkedId);
        if (!mapped) throw new Error('Falha ao autenticar superusuário.');
        setUser(mapped);
        return mapped;
      } catch {
        throw authErr instanceof Error
          ? authErr
          : new Error('E-mail ou senha inválidos.');
      }
    },
    [pb],
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    setUnreadAlertsCount(0);
    setCurationMap(loadLocalCarPrefs());
  }, [pb]);

  const updateProfile = useCallback(
    async (patch: { name?: string; alerts_enabled?: boolean }) => {
      if (!user || user.isSuperuser) return;
      const updated = await pb
        .collection('users')
        .update<Record<string, unknown>>(user.id, patch);
      const mapped = extractAuthUser(updated);
      if (mapped) setUser(mapped);
    },
    [pb, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      pb,
      user,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin' || user?.isSuperuser === true,
      unreadAlertsCount,
      curationMap,
      setCurationMap,
      refreshCuration,
      refreshUnreadCount,
      login,
      logout,
      updateProfile,
    }),
    [
      pb,
      user,
      unreadAlertsCount,
      curationMap,
      refreshCuration,
      refreshUnreadCount,
      login,
      logout,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
