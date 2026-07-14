'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Grape,
  UserPlus,
  Mail,
  Lock,
  Building2,
  User,
  KeyRound,
  Loader2,
} from 'lucide-react'

/* ═══════════════════════════════════════════
   LOGIN PAGE
   ═══════════════════════════════════════════ */
export function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  const { signIn, resetPassword, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const result = await signIn(email, password)
    if (result.error) {
      setError(result.error)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetError('')
    if (!resetEmail.trim()) {
      setResetError('Please enter your email')
      return
    }
    const result = await resetPassword(resetEmail.trim())
    if (result.error) {
      setResetError(result.error)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          {/* Logo area */}
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg">
              <Grape className="w-7 h-7 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
              VinoCellar Pro
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Sign in to your account
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2 pb-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@yourbusiness.com"
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Forgot password toggle */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => { setShowForgot(true); setError('') }}
                className="text-sm text-purple-600 hover:text-purple-700 hover:underline transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Forgot Password Panel */}
          {showForgot && (
            <div className="mt-4 p-4 rounded-lg bg-purple-50 border border-purple-200">
              {resetSent ? (
                <div className="text-center py-2">
                  <p className="text-sm font-medium text-purple-700">Check your email inbox!</p>
                  <p className="text-xs text-purple-500 mt-1">A password reset link has been sent to {resetEmail}</p>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(false); setResetSent(false); setResetEmail('') }}
                    className="text-sm text-purple-600 hover:underline mt-3"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-3">
                  <p className="text-sm font-medium text-purple-800">Reset your password</p>
                  {resetError && (
                    <p className="text-xs text-red-500">{resetError}</p>
                  )}
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="h-10"
                    disabled={loading}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={loading}
                      className="flex-1 h-9 bg-purple-600 hover:bg-purple-700 text-white text-sm"
                    >
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowForgot(false); setResetError('') }}
                      className="h-9 text-sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center pb-6 pt-0">
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={onSwitch}
              className="font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors"
            >
              Sign up
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════
   REGISTER PAGE
   ═══════════════════════════════════════════ */
export function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  const { signUp, loading } = useAuth()

  const [businessName, setBusinessName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!businessName.trim()) errs.businessName = 'Business name is required'
    if (!name.trim()) errs.name = 'Your name is required'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = 'Enter a valid email'
    if (!/^\d{4}$/.test(pin)) errs.pin = 'PIN must be exactly 4 digits'
    if (!password) errs.password = 'Password is required'
    else if (password.length < 6)
      errs.password = 'Password must be at least 6 characters'

    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    if (!validate()) return

    const result = await signUp({
      email: email.trim(),
      password,
      name: name.trim(),
      businessName: businessName.trim(),
      pin,
    })

    if (result.error) {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          {/* Logo area */}
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg">
              <Grape className="w-7 h-7 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
              Create your account
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Set up your store in seconds
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2 pb-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="reg-business" className="text-sm font-medium text-gray-700">
                Business Name
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="reg-business"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. The Wine Vault"
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>
              {fieldErrors.businessName && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.businessName}</p>
              )}
            </div>

            {/* Your Name */}
            <div className="space-y-2">
              <Label htmlFor="reg-name" className="text-sm font-medium text-gray-700">
                Your Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>
              {fieldErrors.name && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="reg-email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@yourbusiness.com"
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <Label htmlFor="reg-pin" className="text-sm font-medium text-gray-700">
                Manager PIN
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
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
                  className="pl-10 h-11 tracking-widest"
                  disabled={loading}
                />
              </div>
              {fieldErrors.pin && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.pin}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="reg-password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center pb-6 pt-0">
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitch}
              className="font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors"
            >
              Sign in
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════
   RESET PASSWORD PAGE (shown after clicking email reset link)
   ═══════════════════════════════════════════ */
import { supabase } from '@/lib/supabase'

export function ResetPasswordPage({ onComplete }: { onComplete: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      // Clear the recovery hash from URL
      window.location.hash = ''
      setTimeout(() => onComplete(), 1500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg">
              <Grape className="w-7 h-7 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
              Set New Password
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Enter your new password below
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2 pb-4">
          {success ? (
            <div className="text-center py-6">
              <p className="text-green-600 font-semibold text-lg">Password updated!</p>
              <p className="text-sm text-gray-500 mt-1">Signing you in...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="pl-10 h-11"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="pl-10 h-11"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </span>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}