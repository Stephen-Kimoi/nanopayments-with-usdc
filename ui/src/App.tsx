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
  { id: 1, label: 'Request sent',           sub: 'POST /chat' },
  { id: 2, label: '402 Payment Required',   sub: 'Server requests payment' },
  { id: 3, label: 'Signing authorization',  sub: 'EIP-3009 · Zero gas' },
  { id: 4, label: 'Circle Gateway settle',  sub: 'GatewayWalletBatched' },
  { id: 5, label: 'Response delivered',     sub: 'Inference complete' },
]
const STEP_DELAYS = [0, 700, 1500, 2500]

// ── Small components ──────────────────────────────────────────
function Dots() {
  return (
    <span className="flex gap-1 items-center">
      {[0, 1, 2].map(i => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block dot-${i + 1}`} />
      ))}
    </span>
  )
}

function StepItem({ step, status, last }: { step: typeof STEPS[0]; status: StepStatus; last: boolean }) {
  const done    = status === 'done'
  const active  = status === 'active'
  const pending = status === 'idle'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-7 shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 transition-all duration-400
          ${done    ? 'bg-emerald-500 text-black font-bold shadow-[0_0_10px_rgba(52,211,153,0.35)]' : ''}
          ${active  ? 'border-2 border-emerald-400 text-emerald-400 bg-[#060f1a] animate-pulse-ring' : ''}
          ${pending ? 'border border-[#1a2e45] text-[#2a4a60] bg-[#060c16]' : ''}
        `}>
          {done ? '✓' : step.id}
        </div>
        {!last && (
          <div className="relative w-px flex-1 my-0.5 bg-[#1a2e45] overflow-hidden" style={{ minHeight: 18 }}>
            {done && <div className="absolute inset-0 bg-emerald-500 step-connector-fill" />}
          </div>
        )}
      </div>
      <div className={`pb-3 ${last ? 'pb-0' : ''}`}>
        <p className={`text-xs font-medium leading-tight transition-colors duration-300
          ${done ? 'text-emerald-400' : active ? 'text-white' : 'text-[#2a4a60]'}
        `} style={{ fontFamily: 'Syne, sans-serif' }}>
          {step.label}
          {step.id === 3 && done && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" style={{ fontFamily: 'DM Mono, monospace' }}>
              zero gas
            </span>
          )}
        </p>
        <p className={`text-[11px] mt-0.5 transition-colors duration-300
          ${done ? 'text-emerald-700' : active ? 'text-slate-400' : 'text-[#1e3048]'}
        `} style={{ fontFamily: 'DM Mono, monospace' }}>
          {step.sub}
        </p>
        {active && <div className="mt-1"><Dots /></div>}
      </div>
    </div>
  )
}

function Pipeline({ step }: { step: number }) {
  if (step === 0) return null
  const getStatus = (id: number): StepStatus =>
    id < step ? 'done' : id === step ? 'active' : 'idle'
  return (
    <div className="animate-fade-up rounded-xl border border-[#0f2035] bg-[#050d18] p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#2a4060] mb-3" style={{ fontFamily: 'DM Mono, monospace' }}>Payment flow</p>
      {STEPS.map((s, i) => (
        <StepItem key={s.id} step={s} status={getStatus(s.id)} last={i === STEPS.length - 1} />
      ))}
    </div>
  )
}

function Receipt({ r }: { r: PaymentReceipt }) {
  const deducted = (parseFloat(r.balanceBefore) - parseFloat(r.balanceAfter)).toFixed(6)
  return (
    <div className="animate-fade-up rounded-xl border border-emerald-900/30 bg-[#040c08] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-emerald-800" style={{ fontFamily: 'DM Mono, monospace' }}>Receipt</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" style={{ fontFamily: 'DM Mono, monospace' }}>settled</span>
      </div>
      {[
        { l: 'Amount',         v: `$${r.amount} ${r.currency}`, em: true },
        { l: 'Network',        v: r.network },
        { l: 'Scheme',         v: r.scheme,          mono: true },
        { l: 'Balance before', v: `${r.balanceBefore} USDC`, mono: true },
        { l: 'Balance after',  v: `${r.balanceAfter} USDC`,  mono: true },
        { l: 'Deducted',       v: `−${deducted} USDC`,       mono: true, dim: true },
      ].map(({ l, v, em, mono, dim }) => (
        <div key={l} className="flex justify-between items-center py-1.5 border-b border-[#0a1a10] last:border-0">
          <span className="text-[11px] text-[#2a5040]">{l}</span>
          <span className={`text-[11px] text-right ml-4 truncate max-w-[55%]
            ${em ? 'text-emerald-400 font-medium' : ''}
            ${mono ? 'text-slate-300' : 'text-slate-300'}
            ${dim ? 'text-slate-500' : ''}
          `} style={mono ? { fontFamily: 'DM Mono, monospace' } : {}}>
            {v}
          </span>
        </div>
      ))}
    </div>
  )
}

function Explainer() {
  return (
    <div className="rounded-xl border border-[#0d1a2a] bg-[#060c16] p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#1e3048] mb-3" style={{ fontFamily: 'DM Mono, monospace' }}>How it works</p>
      <div className="space-y-3">
        {STEPS.map(s => (
          <div key={s.id} className="flex gap-2.5 items-start">
            <span className="w-5 h-5 rounded-full bg-[#070b12] border border-[#0d1a2a] text-[#1e3048] text-[10px] flex items-center justify-center shrink-0 mt-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>{s.id}</span>
            <div>
              <p className="text-[11px] text-slate-400" style={{ fontFamily: 'Syne, sans-serif' }}>{s.label}</p>
              <p className="text-[10px] text-[#1e3048] mt-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#1e3048] mt-4 pt-3 border-t border-[#0d1a2a] leading-relaxed">
        No wallet popups. No gas per call. Circle batches signed authorizations and settles onchain.
      </p>
    </div>
  )
}

const SUGGESTIONS = [
  'What is the x402 payment protocol?',
  'How does batched USDC settlement work?',
  'Why use nano payments for AI APIs?',
]

function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-5">
      <div className="w-11 h-11 rounded-2xl bg-[#060e1a] border border-[#0f2035] flex items-center justify-center text-2xl">⚡</div>
      <div>
        <p className="text-slate-300 font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Ask anything</p>
        <p className="text-[#2a4060] text-xs mt-1.5 leading-relaxed">
          Each message costs <span className="text-emerald-600" style={{ fontFamily: 'DM Mono, monospace' }}>$0.01 USDC</span> — paid instantly<br />via Circle Gateway. No wallet pop-ups.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 w-full max-w-xs">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => onSuggest(s)}
            className="text-left text-xs text-[#2a4060] hover:text-slate-300 px-3 py-2 rounded-lg border border-[#0d1f35] hover:border-[#1a3a5c] bg-[#060e1a] hover:bg-[#0a1628] transition-all duration-200">
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
    <div className="min-h-screen flex flex-col" style={{ background: '#070b12' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #0d1a2a', background: 'rgba(7,11,18,0.85)' }}
        className="sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-black text-xs font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>N</span>
            </div>
            <span className="font-bold text-white text-sm tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>NanoAI</span>
            <span className="hidden sm:block text-xs text-[#1e3a5a]" style={{ fontFamily: 'DM Mono, monospace' }}>/ pay-per-call inference</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: '#060e1a', border: '1px solid #0f2035' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-xs text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>Base Sepolia</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: '#060e1a', border: '1px solid #0f2035' }}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${balFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-xs text-slate-400" style={{ fontFamily: 'DM Mono, monospace' }}>
                Gateway: <span className="text-emerald-400 font-medium">{balFetching ? '...' : `${balance.gateway} USDC`}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-5 flex gap-5" style={{ minHeight: 0 }}>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl overflow-hidden" style={{ border: '1px solid #0d1a2a', background: '#060c16' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {messages.length === 0 && !loading
              ? <EmptyState onSuggest={s => { setInput(s); inputRef.current?.focus() }} />
              : messages.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end animate-fade-up">
                      <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-slate-200 leading-relaxed" style={{ background: '#0f2035', border: '1px solid #1a3a5c' }}>
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3 animate-fade-up">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#060e1a', border: '1px solid #0f2035' }}>
                        <span className="text-emerald-400 text-xs font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 leading-relaxed" style={{ background: '#060e1a', border: '1px solid #0f2035' }}>
                          {m.content}
                        </div>
                        {m.receipt && (
                          <p className="text-[11px] mt-1.5 text-emerald-800" style={{ fontFamily: 'DM Mono, monospace' }}>
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
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: '#060e1a', border: '1px solid #0f2035' }}>
                  <span className="text-emerald-400 text-xs font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>N</span>
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center" style={{ background: '#060e1a', border: '1px solid #0f2035' }}>
                  <Dots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid #0d1a2a' }} className="p-4">
            <div className="flex gap-3 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={loading}
                placeholder="Ask anything — each reply costs $0.01 USDC"
                rows={1}
                className="flex-1 text-sm text-slate-200 placeholder:text-[#1e3a5a] resize-none outline-none disabled:opacity-50 rounded-xl px-4 py-3 transition-colors"
                style={{ background: '#070b12', border: '1px solid #0d1a2a', fontFamily: 'Instrument Sans, sans-serif', lineHeight: '1.6' }}
                onFocus={e => e.target.style.borderColor = '#1a3a5c'}
                onBlur={e => e.target.style.borderColor = '#0d1a2a'}
              />
              <button onClick={send} disabled={loading || !input.trim()}
                className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 active:scale-95"
                style={{ color: '#000' }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8L2 2l2 6-2 6 12-6z" fill="currentColor" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-[#1e3048] mt-2 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>
              ↵ send · shift+↵ newline · powered by Circle Gateway Nano Payments
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-68 shrink-0 hidden lg:flex flex-col gap-4" style={{ width: 272 }}>
          {currentStep > 0 && <Pipeline step={currentStep} />}
          {currentStep === 0 && (lastReceipt ? <Receipt r={lastReceipt} /> : <Explainer />)}

          {/* Stats */}
          <div className="rounded-xl p-4 grid grid-cols-2 gap-3" style={{ border: '1px solid #0d1a2a', background: '#060c16' }}>
            {[
              { l: 'Price / call', v: '$0.01 USDC', em: true },
              { l: 'Network', v: 'Base Sepolia', em: false },
              { l: 'Settlement', v: 'Batched', em: false },
              { l: 'Gas per call', v: '$0.00', em: true },
            ].map(({ l, v, em }) => (
              <div key={l}>
                <p className="text-[10px] text-[#1e3048]" style={{ fontFamily: 'DM Mono, monospace' }}>{l}</p>
                <p className={`text-xs font-semibold mt-1 ${em ? 'text-emerald-400' : 'text-slate-300'}`} style={{ fontFamily: 'Syne, sans-serif' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
