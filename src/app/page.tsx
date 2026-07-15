import Link from 'next/link'
import { PLAN_LIMITS } from '@/lib/plan-limits'
import { formatKSh } from '@/lib/currency'

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    title: 'Inventory Tracking',
    desc: 'Track every bottle across multiple stores. Real-time stock levels, low-stock alerts, and automatic SKU generation.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
    title: 'Point of Sale',
    desc: 'Fast checkout with PIN-protected staff accounts. Supports M-Pesa, cash, and card payments with automatic stock deduction.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Sales Analytics',
    desc: 'Real-time dashboards showing revenue trends, top products, and peak hours. Make data-driven decisions for your business.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: 'Staff Management',
    desc: 'Add staff with secure 4-digit PINs. Control who can sell, manage inventory, or view reports with role-based access.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Expense Tracking',
    desc: 'Record and categorize every expense. Track supplier payments, rent, utilities, and see your true profit margins.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Secure & Reliable',
    desc: 'Bank-grade security with encrypted data. Cloud-hosted on reliable infrastructure so your data is safe and always available.',
  },
]

const STEPS = [
  { num: '1', title: 'Create Your Account', desc: 'Sign up in 30 seconds with your email. No credit card needed for the 14-day free trial.' },
  { num: '2', title: 'Set Up Your Store', desc: 'Add your store name, location, and start adding products. Import from spreadsheet or add manually.' },
  { num: '3', title: 'Start Selling', desc: 'Your staff can start making sales immediately. Track everything in real-time from your dashboard.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-1.5 0-2.7 1.2-2.7 2.7v4.5c0 .5-.1 1-.3 1.4L6.6 15.3c-.3.5-.1 1.1.4 1.4l3.6 1.8c.8.4 1.8.4 2.6 0l3.6-1.8c.5-.3.7-.9.4-1.4l-2.4-4.4c-.2-.5-.3-1-.3-1.4V4.95c0-1.5-1.2-2.7-2.7-2.7h.2z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900">VinoCellar<span className="text-purple-600"> Pro</span></span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            14-day free trial — No credit card required
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Run Your Wine & Spirits Business{' '}
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Like a Pro
            </span>
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Inventory tracking, point of sale, staff management, and sales analytics —
            all in one simple platform built for Kenyan wine and spirits stores.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/25 text-base"
            >
              Start Free Trial
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors text-base bg-white"
            >
              See Features
            </a>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Trusted by stores across Kenya · M-Pesa & card payments supported
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Everything You Need</h2>
            <p className="mt-3 text-slate-500 max-w-xl mx-auto">
              All the tools to manage your store efficiently — from stock room to sales counter to profit reports.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-xl p-6 border border-slate-200/60 hover:border-purple-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Up and Running in Minutes</h2>
            <p className="mt-3 text-slate-500">No complex setup. No training needed.</p>
          </div>

          <div className="space-y-8">
            {STEPS.map((s) => (
              <div key={s.num} className="flex gap-4 sm:gap-6">
                <div className="shrink-0 w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                  {s.num}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Simple, Transparent Pricing</h2>
            <p className="mt-3 text-slate-500">Start free. Upgrade when you&apos;re ready.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { key: 'trial', highlight: false },
              { key: 'starter', highlight: false },
              { key: 'professional', highlight: true },
              { key: 'enterprise', highlight: false },
            ].map(({ key, highlight }) => {
              const plan = PLAN_LIMITS[key]
              return (
                <div
                  key={key}
                  className={`rounded-xl p-5 border flex flex-col ${
                    highlight
                      ? 'border-purple-300 bg-white shadow-lg shadow-purple-600/10 ring-1 ring-purple-200'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {highlight && (
                    <span className="self-start text-[10px] font-semibold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full mb-3">
                      Popular
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-slate-900">{plan.label}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {plan.price === 0 ? 'Free' : formatKSh(plan.price)}
                    </span>
                    {plan.price > 0 && <span className="text-sm text-slate-400">/mo</span>}
                  </div>

                  <ul className="space-y-2 text-sm text-slate-600 flex-1">
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      Up to {plan.max_stores === 999 ? 'unlimited' : plan.max_stores} store{plan.max_stores !== 1 ? 's' : ''}
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      Up to {plan.max_staff === 999 ? 'unlimited' : plan.max_staff} staff
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      Up to {plan.max_products === 9999 ? 'unlimited' : plan.max_products} products
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      Full POS & analytics
                    </li>
                  </ul>

                  <Link
                    href="/app"
                    className={`mt-5 w-full inline-flex items-center justify-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      highlight
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50 bg-white'
                    }`}
                  >
                    {plan.price === 0 ? 'Start Free Trial' : 'Get Started'}
                  </Link>
                </div>
              )
            })}
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            All plans include a 14-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Ready to Take Control of Your Inventory?
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Join Kenyan stores already using VinoCellar Pro to save time, reduce losses, and grow their business.
          </p>
          <Link
            href="/app"
            className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/25 text-base"
          >
            Create Free Account
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-1.5 0-2.7 1.2-2.7 2.7v4.5c0 .5-.1 1-.3 1.4L6.6 15.3c-.3.5-.1 1.1.4 1.4l3.6 1.8c.8.4 1.8.4 2.6 0l3.6-1.8c.5-.3.7-.9.4-1.4l-2.4-4.4c-.2-.5-.3-1-.3-1.4V4.95c0-1.5-1.2-2.7-2.7-2.7h.2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">VinoCellar Pro</span>
          </div>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} VinoCellar Pro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}