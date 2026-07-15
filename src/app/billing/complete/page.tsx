'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function BillingCompletePage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your payment...')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference') || params.get('trxref')

    if (!reference) {
      setStatus('error')
      setMessage('No payment reference found.')
      return
    }

    // Get token from Supabase stored in localStorage
    let token = ''
    try {
      const stored = localStorage.getItem('sb-rnllkgdsnbybjgvbgagp-auth-token')
      if (stored) {
        const parsed = JSON.parse(stored)
        token = parsed?.access_token || ''
      }
    } catch { /* ignore */ }

    fetch('/api/billing/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ reference }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.verified) {
          setStatus('success')
          setMessage(`Successfully subscribed to the ${data.plan} plan!`)
        } else {
          setStatus('error')
          setMessage('Payment verification failed. Please contact support if you were charged.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Could not verify payment. Please contact support.')
      })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-purple-600 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">Processing Payment</h1>
              <p className="text-sm text-slate-500">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
              <p className="text-sm text-slate-500 mb-6">{message}</p>
              <Button
                onClick={() => router.push('/')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Go to Dashboard
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">Payment Issue</h1>
              <p className="text-sm text-slate-500 mb-6">{message}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push('/billing/complete')}>
                  Try Again
                </Button>
                <Button onClick={() => router.push('/')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Go to Dashboard
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}