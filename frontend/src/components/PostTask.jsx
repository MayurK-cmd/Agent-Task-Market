import { useState } from 'react'
import { useWallet }      from '../hooks/useWallet.jsx'
import { postTaskOnChain, preparePostTaskOnChain } from '../hooks/useMarketPlace.js'
import { CATEGORIES, EXPLORER }         from '../lib/config.js'

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, animation: 'fade-in 0.15s ease',
}
const modal = {
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 12, padding: 28, width: '100%', maxWidth: 480,
  animation: 'slide-in 0.2s ease',
}
const label = { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }
const field = { marginBottom: 16 }

const btn = (variant = 'primary') => ({
  background:   variant === 'primary' ? 'var(--accent)' : 'transparent',
  border:       variant === 'primary' ? 'none' : '1px solid var(--border2)',
  color:        variant === 'primary' ? '#000' : 'var(--text2)',
  fontFamily:   'var(--mono)', fontSize: 12, fontWeight: 700,
  padding:      '10px 20px', borderRadius: 'var(--r)', transition: 'opacity 0.15s',
  letterSpacing:'0.04em',
})

const STEPS = {
  idle: 'idle',
  signing: 'signing',
  preparing: 'preparing',
  sign_ready: 'sign_ready',
  confirming: 'confirming',
  done: 'done',
  error: 'error',
}

function walletSigningLabel(wallet) {
  if (!wallet || wallet.isManual) return 'your wallet'
  if (wallet.isRabet) return 'Rabet'
  if (wallet.isFreighter) return 'Freighter'
  return 'your wallet'
}

export default function PostTask({ onClose, onSuccess }) {
  const { wallet, authHeaders, signSorobanTx } = useWallet()
  const walletLabel = walletSigningLabel(wallet)

  const [form, setForm] = useState({
    title: '', description: '', category: 'data_collection',
    budgetXlm: '', deadlineDate: '', minRepScore: 0,
  })
  const [step,         setStep]         = useState(STEPS.idle)
  const [preparedXdr,  setPreparedXdr]  = useState(null)
  const [txHash,       setTxHash]       = useState(null)
  const [errMsg,       setErrMsg]       = useState(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const minDate = () => {
    const d = new Date(); d.setHours(d.getHours() + 1)
    return d.toISOString().slice(0,16)
  }

  const validate = () => {
    if (!wallet) return 'Connect your wallet first'
    if (!form.title) return 'Title is required'
    if (!form.budgetXlm) return 'Budget is required'
    if (!form.deadlineDate) return 'Deadline is required'
    if (parseFloat(form.budgetXlm) <= 0) return 'Budget must be > 0'
    return null
  }

  const formLocked =
    step === STEPS.signing ||
    step === STEPS.preparing ||
    step === STEPS.sign_ready ||
    step === STEPS.confirming

  /** API auth + Soroban simulate (no contract signature yet). */
  const submitPrepare = async () => {
    const v = validate()
    if (v) return setErrMsg(v)

    setErrMsg(null)
    setPreparedXdr(null)
    setStep(STEPS.signing)

    try {
      console.log('[PostTask] Calling authHeaders...')
      const headers = await authHeaders()
      console.log('[PostTask] authHeaders returned:', headers)
      setStep(STEPS.preparing)
      console.log('[PostTask] Calling preparePostTaskOnChain...')
      const result = await preparePostTaskOnChain({
        formData: form,
        publicKey: wallet.publicKey,
      })
      console.log('[PostTask] preparePostTaskOnChain returned:', result)
      const xdr = result?.preparedXdr
      console.log('[PostTask] extracted xdr:', xdr)
      setPreparedXdr(xdr)
      setStep(STEPS.sign_ready)
    } catch (err) {
      console.error('[PostTask] Error:', err)
      setPreparedXdr(null)
      setErrMsg(err.message || 'Transaction failed')
      setStep(STEPS.error)
    }
  }

  /** User-clicked: opens the connected extension (e.g. Rabet) for post_task, then Soroban + API. */
  const submitSignAndFinish = async () => {
    const v = validate()
    if (v) return setErrMsg(v)
    if (!preparedXdr) {
      setErrMsg('Transaction is not prepared — use Post task first')
      return setStep(STEPS.error)
    }

    setErrMsg(null)
    setStep(STEPS.confirming)

    try {
      console.log('[PostTask] Calling postTaskOnChain with preparedXdr:', preparedXdr.substring(0, 50) + '...')
      const result = await postTaskOnChain({
        authHeaders,
        formData: form,
        publicKey: wallet.publicKey,
        signTxXdr: signSorobanTx,
        preparedXdr,
      })
      console.log('[PostTask] postTaskOnChain result:', result)
      setTxHash(result.txHash)
      setStep(STEPS.done)
      setTimeout(() => { onSuccess?.(); onClose() }, 2000)
    } catch (err) {
      console.error('[PostTask] postTaskOnChain error:', err)
      setPreparedXdr(null)
      setErrMsg(err.message || 'Transaction failed')
      setStep(STEPS.error)
    }
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Post a task
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
              Budget held in escrow · 20% platform fee on settlement
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {step === STEPS.done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>Task posted on-chain!</div>
            <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--blue)' }}>
              ↗ view transaction
            </a>
          </div>
        ) : (
          <>
            {/* Form fields */}
            <div style={field}>
              <label style={label}>Task title *</label>
              <input value={form.title} onChange={set('title')} disabled={formLocked}
                placeholder="e.g. Scrape top 10 Stellar DeFi protocols by TVL" />
            </div>

            <div style={field}>
              <label style={label}>Description</label>
              <textarea value={form.description} onChange={set('description')} disabled={formLocked}
                placeholder="Detailed requirements, output format, sources to use..."
                style={{ minHeight: 72, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={label}>Category *</label>
                <select value={form.category} onChange={set('category')} disabled={formLocked}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Budget (XLM) *</label>
                <input type="number" min="0.01" step="0.01" value={form.budgetXlm} disabled={formLocked}
                  onChange={set('budgetXlm')} placeholder="e.g. 2.0" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={label}>Deadline *</label>
                <input type="datetime-local" value={form.deadlineDate} disabled={formLocked}
                  onChange={set('deadlineDate')} min={minDate()} />
              </div>
              <div>
                <label style={label}>Min rep score (0 = open to all)</label>
                <input type="number" min="0" max="100" value={form.minRepScore} disabled={formLocked}
                  onChange={set('minRepScore')} placeholder="0" />
              </div>
            </div>

            {/* Budget breakdown */}
            {form.budgetXlm && parseFloat(form.budgetXlm) > 0 && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontFamily: 'var(--mono)', fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text3)' }}>Escrow (total)</span>
                  <span style={{ color: 'var(--text)' }}>{parseFloat(form.budgetXlm).toFixed(4)} XLM</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text3)' }}>Bidder receives (80%)</span>
                  <span style={{ color: 'var(--accent)' }}>{(parseFloat(form.budgetXlm) * 0.8).toFixed(4)} XLM</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text3)' }}>Platform fee (20%)</span>
                  <span style={{ color: 'var(--amber)' }}>{(parseFloat(form.budgetXlm) * 0.2).toFixed(4)} XLM</span>
                </div>
              </div>
            )}

            {/* Error */}
            {errMsg && (
              <div style={{ background: '#ff4d4d18', border: '1px solid #ff4d4d40', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 16, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)' }}>
                {errMsg}
              </div>
            )}

            {/* Step indicator */}
            {step !== STEPS.idle && step !== STEPS.error && (
              <div style={{
                marginBottom: 16,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: step === STEPS.sign_ready ? 'var(--text2)' : 'var(--amber)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}>
                {step !== STEPS.sign_ready && (
                  <div style={{
                    flexShrink: 0,
                    width: 10,
                    height: 10,
                    marginTop: 2,
                    border: '2px solid var(--amber)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                )}
                <span style={{ lineHeight: 1.45 }}>
                  {step === STEPS.signing && 'Sign the API auth message in your Stellar wallet...'}
                  {step === STEPS.preparing && 'Simulating post_task on Soroban (RPC) — wallet opens on the next step...'}
                  {step === STEPS.sign_ready &&
                    `Transaction ready. Click Sign with wallet below — ${walletLabel} should open on that click (after RPC simulation + API auth, a second tap helps the extension prompt).`}
                  {step === STEPS.confirming &&
                    `Approve post_task in ${walletLabel}, then submitting to Soroban and the API...`}
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (step === STEPS.sign_ready) {
                    setPreparedXdr(null)
                    setStep(STEPS.idle)
                    setErrMsg(null)
                  } else {
                    onClose()
                  }
                }}
                style={btn('secondary')}
                disabled={step === STEPS.signing || step === STEPS.preparing || step === STEPS.confirming}
              >
                {step === STEPS.sign_ready ? 'back' : 'cancel'}
              </button>
              {preparedXdr && (step === STEPS.sign_ready || step === STEPS.confirming) ? (
                <button
                  type="button"
                  onClick={submitSignAndFinish}
                  disabled={step === STEPS.confirming}
                  style={{ ...btn('primary'), opacity: step === STEPS.confirming ? 0.6 : 1 }}
                >
                  {step === STEPS.confirming ? 'submitting...' : 'sign with wallet →'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitPrepare}
                  disabled={['signing', 'preparing', 'confirming'].includes(step)}
                  style={{
                    ...btn('primary'),
                    opacity: ['signing', 'preparing', 'confirming'].includes(step) ? 0.6 : 1,
                  }}
                >
                  {['signing', 'preparing'].includes(step) ? 'preparing...' : 'post task →'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}