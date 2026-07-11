import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { signInSchema, signUpSchema } from '@repo/types';
import { supabase } from '@/lib/supabase/client';
import { clearStore, resyncStore } from '@/lib/store';
import { initStoreAuthSync } from '@/lib/store/auth-sync';
import {
  configureGoogleSignIn,
  signInWithGoogleNative,
  signOutGoogleNative,
} from '@/lib/auth/google-signin';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ error: Error | null; session: Session | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null; cancelled?: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configureGoogleSignIn();
    initStoreAuthSync(() => {
      void resyncStore();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      return { error: new Error(parsed.error.errors[0]?.message ?? 'Invalid input') };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const parsed = signUpSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      return {
        error: new Error(parsed.error.errors[0]?.message ?? 'Invalid input'),
        session: null,
      };
    }
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName } },
    });
    if (error) return { error: new Error(error.message), session: null };
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: parsed.data.displayName,
        preferences: { currency: 'USD', theme: 'system', notifications_enabled: true },
      });
    }
    return { error: null, session: data.session ?? null };
  };

  const signInWithGoogle = async () => {
    return signInWithGoogleNative();
  };

  const signOut = async () => {
    await clearStore();
    await signOutGoogleNative();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, signIn, signUp, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
