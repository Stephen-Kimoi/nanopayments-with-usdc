import { useState, useEffect, useRef } from 'react'
import './index.css'

// ── Types ─────────────────────────────────────────────────────
interface PaymentReceipt {
  amount: string
  currency: string
  network: string
  scheme: string
  balanceBefore: string
  balanceAfter: string
}
interface Message {
  role: 'user' | 'assistant'
  content: string
  receipt?: PaymentReceipt
}
interface Balance { gateway: string; wallet: string }
type StepStatus = 'idle' | 'active' | 'done'

// ── Payment steps ─────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Request sent',          sub: 'POST /chat' },
  { id: 2, label: '402 Payment Required',  sub: 'Server requests payment' },
  { id: 3, label: 'Sign authorization',    sub: 'EIP-3009 · zero gas' },
  { id: 4, label: 'Circle Gateway settle', sub: 'GatewayWalletBatched' },
  { id: 5, label: 'Response delivered',    sub: 'Inference complete' },
]
const STEP_DELAYS = [0, 700, 1500, 2500]

// ── Dots loading indicator ────────────────────────────────────
function Dots() {
  return (
    <span className="flex gap-1 items-center">
      {[0, 1, 2].map(i => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block dot-${i + 1}`} />
      ))}
    </span>
  )
}

// ── Step row ──────────────────────────────────────────────────
function StepItem({ step, status, last }: { step: typeof STEPS[0]; status: StepStatus; last: boolean }) {
  const done    = status === 'done'
  const active  = status === 'active'
  const pending = status === 'idle'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-7 shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all duration-400
          ${done    ? 'bg-emerald-500 text-white shadow-sm' : ''}
          ${active  ? 'border-2 border-emerald-500 text-emerald-600 bg-emerald-50 animate-pulse-ring' : ''}
          ${pending ? 'border border-slate-200 text-slate-300 bg-white' : ''}
        `} style={{ fontFamily: 'DM Mono, monospace' }}>
          {done ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : step.id}
        </div>
        {!last && (
          <div className="relative w-px flex-1 my-1 bg-slate-100 overflow-hidden" style={{ minHeight: 16 }}>
            {done && <div className="absolute inset-0 bg-emerald-400 step-connector-fill" />}
          </div>
        )}
      </div>
      <div className={`pb-3 ${last ? 'pb-0' : ''}`}>
        <p className={`text-[13px] font-semibold leading-tight transition-colors duration-300
          ${done ? 'text-emerald-600' : active ? 'text-slate-800' : 'text-slate-300'}
        `} style={{ fontFamily: 'Syne, sans-serif' }}>
          {step.label}
          {step.id === 3 && done && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>
              zero gas
            </span>
          )}
        </p>
        <p className={`text-[11px] mt-0.5 transition-colors duration-300
          ${done ? 'text-emerald-500' : active ? 'text-slate-500' : 'text-slate-200'}
        `} style={{ fontFamily: 'DM Mono, monospace' }}>
          {step.sub}
        </p>
        {active && <div className="mt-1.5"><Dots /></div>}
      </div>
    </div>
  )
}

// ── Payment pipeline panel ────────────────────────────────────
function Pipeline({ step }: { step: number }) {
  if (step === 0) return null
  const getStatus = (id: number): StepStatus =>
    id < step ? 'done' : id === step ? 'active' : 'idle'
  return (
    <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-4 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>Payment flow</p>
      {STEPS.map((s, i) => (
        <StepItem key={s.id} step={s} status={getStatus(s.id)} last={i === STEPS.length - 1} />
      ))}
    </div>
  )
}

// ── Receipt card ──────────────────────────────────────────────
function Receipt({ r }: { r: PaymentReceipt }) {
  const deducted = (parseFloat(r.balanceBefore) - parseFloat(r.balanceAfter)).toFixed(6)
  return (
    <div className="animate-fade-up rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>Receipt</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>settled</span>
      </div>
      {[
        { l: 'Amount',         v: `$${r.amount} ${r.currency}`, em: true },
        { l: 'Network',        v: r.network },
        { l: 'Scheme',         v: r.scheme,          mono: true },
        { l: 'Balance before', v: `${r.balanceBefore} USDC`, mono: true },
        { l: 'Balance after',  v: `${r.balanceAfter} USDC`,  mono: true },
        { l: 'Deducted',       v: `−${deducted} USDC`,       mono: true, dim: true },
      ].map(({ l, v, em, mono, dim }) => (
        <div key={l} className="flex justify-between items-center py-2 border-b border-emerald-100 last:border-0">
          <span className="text-[12px] text-emerald-700">{l}</span>
          <span className={`text-[12px] font-medium text-right ml-4 truncate max-w-[55%]
            ${em ? 'text-emerald-600' : ''}
            ${dim ? 'text-slate-400' : !em ? 'text-slate-700' : ''}
          `} style={mono ? { fontFamily: 'DM Mono, monospace' } : {}}>
            {v}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Explainer (idle state of right panel) ────────────────────
function Explainer() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-4 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>How it works</p>
      <div className="space-y-3.5">
        {STEPS.map(s => (
          <div key={s.id} className="flex gap-3 items-start">
            <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>{s.id}</span>
            <div>
              <p className="text-[13px] text-slate-700 font-semibold leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>{s.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-slate-500 mt-4 pt-4 border-t border-slate-100 leading-relaxed">
        No wallet pop-ups. No gas per call. Circle batches signed authorizations and settles onchain.
      </p>
    </div>
  )
}

// ── Suggestion chips ──────────────────────────────────────────
const SUGGESTIONS = [
  'What is the x402 payment protocol?',
  'How does batched USDC settlement work?',
  'Why use nano payments for AI APIs?',
]

function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-6">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl shadow-sm">
        ⚡
      </div>
      <div>
        <p className="text-slate-800 font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>Ask anything</p>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-xs">
          Each message costs{' '}
          <span className="text-emerald-600 font-semibold" style={{ fontFamily: 'DM Mono, monospace' }}>$0.01 USDC</span>
          {' '}— paid instantly via Circle Gateway.
          <br />No wallet pop-ups.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => onSuggest(s)}
            className="text-left text-sm text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50 transition-all duration-200 shadow-sm">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [balance, setBalance]         = useState<Balance>({ gateway: '—', wallet: '—' })
  const [balFetching, setBalFetching] = useState(true)
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const timers    = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => { fetchBalance() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const fetchBalance = async () => {
    setBalFetching(true)
    try {
      const r = await fetch('/demo/balance')
      setBalance(await r.json())
    } catch { setBalance({ gateway: 'error', wallet: '—' }) }
    finally { setBalFetching(false) }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setLastReceipt(null)
    setCurrentStep(1)
    timers.current.forEach(clearTimeout)
    timers.current = STEP_DELAYS.slice(1).map((d, i) =>
      setTimeout(() => setCurrentStep(i + 2), d)
    )
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
      })
      timers.current.forEach(clearTimeout)
      if (!res.ok) throw new Error((await res.json()).error || 'Request failed')
      const data = await res.json()
      setCurrentStep(5)
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, receipt: data.payment }])
        setLastReceipt(data.payment)
        setCurrentStep(0)
        setLoading(false)
        fetchBalance()
      }, 700)
    } catch (err) {
      timers.current.forEach(clearTimeout)
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }])
      setCurrentStep(0)
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>N</span>
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>NanoAI</span>
            <span className="hidden sm:block text-sm text-slate-400 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>/ pay-per-call inference</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-xs text-slate-600 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>Base Sepolia</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${balFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-xs text-emerald-700 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>
                Gateway: <span className="font-bold">{balFetching ? '...' : `${balance.gateway} USDC`}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-5 flex gap-5" style={{ minHeight: 0 }}>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {messages.length === 0 && !loading
              ? <EmptyState onSuggest={s => { setInput(s); inputRef.current?.focus() }} />
              : messages.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end animate-fade-up">
                      <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white leading-relaxed shadow-sm bg-slate-800">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3 animate-fade-up">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <span className="text-white text-xs font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 leading-relaxed bg-slate-50 border border-slate-200">
                          {m.content}
                        </div>
                        {m.receipt && (
                          <p className="text-[11px] mt-1.5 text-emerald-600 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>
                            ✓ ${m.receipt.amount} USDC paid · {m.receipt.balanceBefore} → {m.receipt.balanceAfter} USDC
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )
            }
            {loading && currentStep === 0 && (
              <div className="flex gap-3 animate-fade-up">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white text-xs font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>N</span>
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center bg-slate-50 border border-slate-200">
                  <Dots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex gap-3 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={loading}
                placeholder="Ask anything — each reply costs $0.01 USDC"
                rows={1}
                className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 resize-none outline-none disabled:opacity-50 rounded-xl px-4 py-3 transition-colors border border-slate-200 hover:border-slate-300 focus:border-emerald-400 bg-slate-50"
                style={{ fontFamily: 'Instrument Sans, sans-serif', lineHeight: '1.6' }}
              />
              <button onClick={send} disabled={loading || !input.trim()}
                className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8L2 2l2 6-2 6 12-6z" fill="white" />
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>
              ↵ send · shift+↵ newline · powered by Circle Gateway Nano Payments
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 hidden lg:flex flex-col gap-4">
          {currentStep > 0 && <Pipeline step={currentStep} />}
          {currentStep === 0 && (lastReceipt ? <Receipt r={lastReceipt} /> : <Explainer />)}

          {/* Stats grid */}
          <div className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm grid grid-cols-2 gap-4">
            {[
              { l: 'Price / call', v: '$0.01 USDC', em: true },
              { l: 'Network',      v: 'Base Sepolia', em: false },
              { l: 'Settlement',   v: 'Batched',      em: false },
              { l: 'Gas per call', v: '$0.00',        em: true },
            ].map(({ l, v, em }) => (
              <div key={l}>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>{l}</p>
                <p className={`text-sm font-bold mt-1 ${em ? 'text-emerald-600' : 'text-slate-700'}`} style={{ fontFamily: 'Syne, sans-serif' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
