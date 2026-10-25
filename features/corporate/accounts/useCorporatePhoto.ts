"use client";
/**
 * Loads the company account image and exposes save/remove state.
 * The hook checks the current identity and invalidates older requests when the account changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { fetchProfileAvatar, saveProfileAvatar } from '@/lib/accounts/profile';
import { useProfilePhotoUrl } from '@/hooks/useProfilePhotoUrl';

type Photo = { userId: string; path: string | null; preview: string | null };

/** The corporate workspace owns its image state; no volunteer provider is mounted.
 * User-scoped state and request generations keep late responses out of a new session. */
export function useCorporatePhoto(userId: string | undefined) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [status, setStatus] = useState({ userId, loading: Boolean(userId), error: '' });
  const [saving, setSaving] = useState(false);
  const sequence = useRef(0), locked = useRef(false);
  const invalidate = useCallback(() => { ++sequence.current; }, []);
  const reload = useCallback(async () => {
    if (!userId || locked.current) return;
    const request = ++sequence.current;
    setStatus({ userId, loading: true, error: '' });
    try {
      const path = await fetchProfileAvatar(userId);
      if (request !== sequence.current) return;
      setPhoto(current => current?.userId === userId && current.path === path ? current : { userId, path, preview: null });
      setStatus({ userId, loading: false, error: '' });
    } catch {
      if (request === sequence.current) setStatus({ userId, loading: false, error: 'Your saved image could not be loaded. Please retry.' });
    }
  }, [userId]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void reload(); });
    const refresh = () => { void reload(); };
    if (typeof window !== 'undefined') window.addEventListener('focus', refresh);
    return () => { active = false; invalidate(); if (typeof window !== 'undefined') window.removeEventListener('focus', refresh); };
  }, [reload, invalidate]);
  useEffect(() => () => { if (photo?.preview) URL.revokeObjectURL(photo.preview); }, [photo]);

  const save = useCallback(async (blob: Blob | null): Promise<string | null> => {
    if (!userId) return 'Sign in again before changing your image.';
    if (locked.current) return 'An image update is already in progress.';
    locked.current = true; setSaving(true);
    const request = ++sequence.current;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (request !== sequence.current || error || data.user?.id !== userId) return 'Your session changed. Sign in again before changing your image.';
      const result = await saveProfileAvatar(userId, blob);
      if (request !== sequence.current) return 'Your session changed. Refresh to check the saved image.';
      if (result.error || !result.data) return result.error || 'Your image could not be saved. Please retry.';
      setPhoto({ userId, path: result.data.avatar_path ?? null, preview: blob ? URL.createObjectURL(blob) : null });
      setStatus({ userId, loading: false, error: '' });
      return null;
    } catch {
      return 'Your image could not be saved. Please retry.';
    } finally { locked.current = false; setSaving(false); }
  }, [userId]);
  const current = photo?.userId === userId ? photo : null;
  const avatarUrl = useProfilePhotoUrl(current?.path, current?.preview ?? null);
  return { avatarUrl, path: current?.path ?? null, loading: Boolean(userId) && (status.userId !== userId || status.loading), error: status.userId === userId ? status.error : '', saving, save, reload };
}
