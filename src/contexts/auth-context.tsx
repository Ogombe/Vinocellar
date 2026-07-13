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
    const { data: profile } = await supabase
      .from('users')
      .select('*, organisation:organisations(*), store:stores(*)')
      .eq('id', userId)
      .single()

    if (profile) {
      setAppUser(profile)
      setOrganisation(profile.organisation)
      setStore(profile.store)
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

  const signUp = async ({ email, password, name, businessName, pin }: {
    email: string; password: string; name: string; businessName: string; pin: string
  }) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password, name, business_name: businessName, pin }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'Registration failed' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
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