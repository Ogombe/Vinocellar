'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'

/* ─── shared animation keyframes ─── */
const animStyle = (
  <style>{`
    @keyframes popIn {
      0%   { opacity: 0; transform: translateY(18px) scale(.97); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    .auth-pop { animation: popIn .4s cubic-bezier(.22,1,.36,1) both; }
  `}</style>
)

/* ─── Wine‑glass SVG icon ─── */
function WineGlassIcon({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M18 4h12v2c0 6-2 10-6 13-4-3-6-7-6-13V4z"
        fill="#DC2626"
        opacity=".15"
      />
      <path
        d="M18 4h12c0 8-2.5 14-6 17-3.5-3-6-9-6-17z"
        stroke="#DC2626"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="24" y1="21" x2="24" y2="36" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="36" x2="30" y2="36" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 12c-2 2-3 5-3 8h20c0-3-1-6-3-8" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" opacity=".4" />
    </svg>
  )
}

/* ─── Brand header used in both pages ─── */
function BrandHeader() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center mb-3">
        <WineGlassIcon className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <span style={{ color: '#1F1129' }}>VinoCellar</span>
        <span style={{ color: '#F59E0B' }}> Pro</span>
      </h1>
      <p className="text-sm mt-1" style={{ color: '#6B5E7A' }}>
        Wine &amp; Spirits Inventory Management
      </p>
    </div>
  )
}

/* ─── Input wrapper ─── */
function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  )
}

const baseInput =
  'w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all duration-150 focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626]'

/* ═══════════════════════════════════════════
   NUMERIC KEYPAD (used by LoginPage PIN)
   ═══════════════════════════════════════════ */
function Numpad({
  onDigit,
  onBackspace,
  disabled,
}: {
  onDigit: (d: string) => void
  onBackspace: () => void
  disabled: boolean
}) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']
  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {keys.map((k) => {
        if (k === '') return <div key="blank" />
        if (k === 'del') {
          return (
            <button
              key="del"
              type="button"
              disabled={disabled}
              onClick={onBackspace}
              className="h-12 rounded-xl text-sm font-semibold border border-[#E8E0F0] bg-white hover:bg-[#FAF7F2] active:scale-95 transition disabled:opacity-40"
              aria-label="Backspace"
            >
              {/* backspace SVG */}
              <svg className="w-5 h-5 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.707 4.879A3 3 0 018.828 4H15a3 3 0 013 3v6a3 3 0 01-3 3H8.828a3 3 0 01-2.12-.879l-4.415-4.414a1 1 0 010-1.414l4.414-4.414zm4 2.414a1 1 0 00-1.414 1.414L10.586 10l-1.293 1.293a1 1 0 101.414 1.414L12 11.414l1.293 1.293a1 1 0 001.414-1.414L13.414 10l1.293-1.293a1 1 0 00-1.414-1.414L12 8.586l-1.293-1.293z" clipRule="evenodd" />
              </svg>
            </button>
          )
        }
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(k)}
            className="h-12 rounded-xl text-lg font-semibold border border-[#E8E0F0] bg-white hover:bg-[#FAF7F2] active:scale-95 transition disabled:opacity-40"
          >
            {k}
          </button>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════
   PIN DOT DISPLAY (4 circles)
   ═══════════════════════════════════════════ */
function PinDots({ value }: { value: string }) {
  return (
    <div className="flex justify-center gap-3 mb-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-4 h-4 rounded-full border-2 transition-all duration-150"
          style={{
            borderColor: i < value.length ? '#DC2626' : '#D6CDE0',
            backgroundColor: i < value.length ? '#DC2626' : 'transparent',
          }}
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════
   LOGIN PAGE
   ═══════════════════════════════════════════ */
export function LoginPage({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const setAuth = useAppStore((s) => s.setAuth)

  const [tab, setTab] = useState<'email' | 'pin'>('email')

  // email state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // pin state
  const [pin, setPin] = useState('')

  // shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login({ email, password })
      setAuth(res.user, res.org, res.stores ?? [], res.storeId ?? null)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handlePinLogin() {
    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.login({ pin })
      setAuth(res.user, res.org, res.stores ?? [], res.storeId ?? null)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function handleNumpadDigit(d: string) {
    if (pin.length >= 4) return
    setPin((p) => p + d)
    if (pin.length === 3) {
      // auto-submit on 4th digit
      const newPin = pin + d
      setPin(newPin)
      // small delay so user sees the 4th dot
      setTimeout(() => {
        setError('')
        setLoading(true)
        api
          .login({ pin: newPin })
          .then((res) => {
            setAuth(res.user, res.org, res.stores ?? [], res.storeId ?? null)
          })
          .catch((err: any) => {
            setError(err.message || 'Login failed')
            setPin('')
          })
          .finally(() => setLoading(false))
      }, 180)
    }
  }

  function handleNumpadBackspace() {
    setPin((p) => p.slice(0, -1))
  }

  return (
    <>
      {animStyle}
      <div
        className="min-h-screen flex items-center justify-center px-4 py-10"
        style={{ backgroundColor: '#FAF7F2' }}
      >
        <div
          className="auth-pop w-full max-w-md rounded-[14px] p-8"
          style={{
            backgroundColor: '#fff',
            boxShadow: '0 4px 12px rgba(31,17,41,.06)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <BrandHeader />

          {/* ── Tabs ── */}
          <div
            className="flex rounded-xl p-1 mb-6"
            style={{ backgroundColor: '#F5F0EB' }}
          >
            {(['email', 'pin'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(''); setPin('') }}
                className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#1F1129' : '#8B7FA0',
                  boxShadow: tab === t ? '0 1px 4px rgba(31,17,41,.08)' : 'none',
                }}
              >
                {t === 'email' ? 'Email Login' : 'PIN Login'}
              </button>
            ))}
          </div>

          {/* ── Error ── */}
          {error && (
            <div
              className="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
            >
              {error}
            </div>
          )}

          {/* ── Email Tab ── */}
          {tab === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-0">
              <Field label="Email" id="login-email">
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@yourbusiness.com"
                  className={baseInput}
                  style={{ borderColor: '#E8E0F0' }}
                />
              </Field>
              <Field label="Password" id="login-pass">
                <input
                  id="login-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={baseInput}
                  style={{ borderColor: '#E8E0F0' }}
                />
              </Field>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[.98] disabled:opacity-60 mt-2"
                style={{ backgroundColor: '#DC2626' }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}

          {/* ── PIN Tab ── */}
          {tab === 'pin' && (
            <div className="flex flex-col items-center">
              <p className="text-sm mb-4" style={{ color: '#6B5E7A' }}>
                Enter your 4-digit manager PIN
              </p>
              <PinDots value={pin} />
              {loading && (
                <div className="mt-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" style={{ color: '#DC2626' }}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </div>
              )}
              <Numpad
                onDigit={handleNumpadDigit}
                onBackspace={handleNumpadBackspace}
                disabled={loading || pin.length >= 4}
              />
            </div>
          )}

          {/* ── Switch link ── */}
          <p className="text-center text-sm mt-8" style={{ color: '#8B7FA0' }}>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-semibold hover:underline"
              style={{ color: '#DC2626' }}
            >
              Register
            </button>
          </p>
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════
   REGISTER PAGE
   ═══════════════════════════════════════════ */
export function RegisterPage({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const setAuth = useAppStore((s) => s.setAuth)

  const [businessName, setBusinessName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pin, setPin] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!businessName.trim()) errs.businessName = 'Business name is required'
    if (!managerName.trim()) errs.managerName = 'Manager name is required'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email'
    if (!password) errs.password = 'Password is required'
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters'
    if (!/^\d{4}$/.test(pin)) errs.pin = 'PIN must be exactly 4 digits'

    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    if (!validate()) return

    setLoading(true)
    try {
      const res = await api.register({
        businessName: businessName.trim(),
        managerName: managerName.trim(),
        email: email.trim(),
        password,
        pin,
      })
      setAuth(res.user, res.org, res.stores ?? [], res.storeId ?? null)
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {animStyle}
      <div
        className="min-h-screen flex items-center justify-center px-4 py-10"
        style={{ backgroundColor: '#FAF7F2' }}
      >
        <div
          className="auth-pop w-full max-w-md rounded-[14px] p-8"
          style={{
            backgroundColor: '#fff',
            boxShadow: '0 4px 12px rgba(31,17,41,.06)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <BrandHeader />

          {/* ── Error banner ── */}
          {error && (
            <div
              className="mb-5 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-0">
            {/* Business Name */}
            <Field label="Business Name" id="reg-business" error={fieldErrors.businessName}>
              <input
                id="reg-business"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. The Wine Vault"
                className={baseInput}
                style={{ borderColor: fieldErrors.businessName ? '#DC2626' : '#E8E0F0' }}
              />
            </Field>

            {/* Manager Name */}
            <Field label="Manager Name" id="reg-name" error={fieldErrors.managerName}>
              <input
                id="reg-name"
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="John Doe"
                className={baseInput}
                style={{ borderColor: fieldErrors.managerName ? '#DC2626' : '#E8E0F0' }}
              />
            </Field>

            {/* Email */}
            <Field label="Email" id="reg-email" error={fieldErrors.email}>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@yourbusiness.com"
                className={baseInput}
                style={{ borderColor: fieldErrors.email ? '#DC2626' : '#E8E0F0' }}
              />
            </Field>

            {/* Password */}
            <Field label="Password" id="reg-pass" error={fieldErrors.password}>
              <div className="relative">
                <input
                  id="reg-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className={baseInput}
                  style={{ borderColor: fieldErrors.password ? '#DC2626' : '#E8E0F0', paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                  style={{ color: '#8B7FA0' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    /* eye-off SVG */
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    /* eye SVG */
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </Field>

            {/* Manager PIN */}
            <Field label="Manager PIN" id="reg-pin" error={fieldErrors.pin}>
              <input
                id="reg-pin"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setPin(v)
                }}
                placeholder="4-digit PIN"
                className={baseInput}
                style={{ borderColor: fieldErrors.pin ? '#DC2626' : '#E8E0F0', letterSpacing: '0.35em' }}
              />
            </Field>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[.98] disabled:opacity-60 mt-3"
              style={{ backgroundColor: '#DC2626' }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* ── Switch link ── */}
          <p className="text-center text-sm mt-6" style={{ color: '#8B7FA0' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-semibold hover:underline"
              style={{ color: '#DC2626' }}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </>
  )
}