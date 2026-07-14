'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User as AppUser, Organisation, Store } from '@/lib/types'

interface AuthContextType {
  session: Session | null
  user: User | null
  appUser: AppUser | null
  organisation: Organisation | null
  store: Store | null
  loading: boolean
  signUp: (data: { email: string; password: string; name: string; businessName: string; pin: string }) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [organisation, setOrganisation] = useState<Organisation | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    try {
      // Fetch user with organisation (FK exists for org)
      const { data: profile, error } = await supabase
        .from('users')
        .select('*, organisation:organisations(*)')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Profile load error:', error.message)
        return
      }
      if (profile) {
        setAppUser(profile)
        setOrganisation(profile.organisation)

        // Fetch store separately (no FK relationship detected by PostgREST)
        if (profile.store_id) {
          const { data: storeData } = await supabase
            .from('stores')
            .select('*')
            .eq('id', profile.store_id)
            .single()
          if (storeData) setStore(storeData)
        }
      }
    } catch (err) {
      console.error('Profile load exception:', err)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s?.user) {
        setUser(s.user)
        loadProfile(s.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) {
        setUser(s.user)
        loadProfile(s.user.id)
      } else {
        setUser(null)
        setAppUser(null)
        setOrganisation(null)
        setStore(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Sign up: proxy through local API (avoids Edge Function CORS), then sign in directly
  const signUp = async ({ email, password, name, businessName, pin }: {
    email: string; password: string; name: string; businessName: string; pin: string
  }) => {
    try {
      // 1. Call edge function via local proxy
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, business_name: businessName, pin }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error || 'Registration failed' }

      // 2. Sign in directly via Supabase Auth client (handles session storage)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) return { error: signInError.message }

      return { error: null }
    } catch (err) {
      console.error('Signup error:', err)
      return { error: 'Network error. Please try again.' }
    }
  }

  // Sign in directly via Supabase Auth client
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      return { error: null }
    } catch (err) {
      console.error('Signin error:', err)
      return { error: 'Network error. Please try again.' }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = () => {
    if (user) loadProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ session, user, appUser, organisation, store, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)