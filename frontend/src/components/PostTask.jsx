import { useState } from 'react'
import { useWallet }      from '../hooks/useWallet.jsx'
import { postTaskOnChain, preparePostTaskOnChain } from '../hooks/useMarketPlace.js'
import { CATEGORIES, EXPLORER }         from '../lib/config.js'

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, animation: 'fade-in 0.2s ease',
}
const modal = {
  background: 'linear-gradient(135deg, rgba(15,19,24,0.95), rgba(21,27,34,0.98))',
  border: '1px solid rgba(0,229,160,0.2)',
  borderRadius: 16, padding: 32, width: '100%', maxWidth: 520,
  animation: 'slide-in 0.3s cubic-bezier(0.16,1,0.3,1)',
  boxShadow: '0 0 60px rgba(0,229,160,0.15), 0 24px 80px rgba(0,0,0,0.6)',
}
const label = {
  fontFamily: 'var(--mono)', fontSize: 10,
  color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: '0.1em', display: 'block', marginBottom: 8,
}
const field = { marginBottom: 18 }

const btn = (variant = 'primary', disabled = false) => ({
  background: variant === 'primary'
    ? disabled ? 'var(--border2)' : 'linear-gradient(135deg, var(--accent), rgba(0,229,160,0.9))'
    : 'transparent',
  border: variant === 'primary' ? 'none' : '1px solid var(--border2)',
  color: variant === 'primary' ? '#000' : 'var(--text2)',
  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
  padding: '12px 24px', borderRadius: 'var(--r2)',
  letterSpacing: '0.04em',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'all 0.2s ease',
  boxShadow: variant === 'primary' && !disabled ? '0 0 20px rgba(0,229,160,0.3)' : 'none',
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
        {/* Header with glow effect */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid rgba(30,40,48,0.6)',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)',
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)',
                boxShadow: '0 0 10px rgba(0,229,160,0.5)',
              }} />
              Post a task
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
              Budget held in escrow · 20% platform fee on settlement
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
              color: 'var(--text3)', fontSize: 18, lineHeight: 1,
              width: 32, height: 32, borderRadius: '50%',
              cursor: 'pointer', transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--red)';
              e.currentTarget.style.borderColor = 'var(--red)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text3)';
            }}
          >×</button>
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
              <input
                value={form.title}
                onChange={set('title')}
                disabled={formLocked}
                placeholder="e.g. Scrape top 10 Stellar DeFi protocols by TVL"
                style={{
                  background: 'rgba(10,12,15,0.5)',
                  border: '1px solid var(--border2)',
                  transition: 'all 0.2s ease',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,160,0.1)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={field}>
              <label style={label}>Description</label>
              <textarea
                value={form.description}
                onChange={set('description')}
                disabled={formLocked}
                placeholder="Detailed requirements, output format, sources to use..."
                style={{
                  minHeight: 80, resize: 'vertical',
                  background: 'rgba(10,12,15,0.5)',
                  border: '1px solid var(--border2)',
                  transition: 'all 0.2s ease',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,160,0.1)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={label}>Category *</label>
                <select
                  value={form.category}
                  onChange={set('category')}
                  disabled={formLocked}
                  style={{
                    background: 'rgba(10,12,15,0.5)',
                    border: '1px solid var(--border2)',
                    cursor: formLocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Budget (XLM) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.budgetXlm}
                  disabled={formLocked}
                  onChange={set('budgetXlm')}
                  placeholder="e.g. 2.0"
                  style={{
                    background: 'rgba(10,12,15,0.5)',
                    border: '1px solid var(--border2)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={label}>Deadline *</label>
                <input
                  type="datetime-local"
                  value={form.deadlineDate}
                  disabled={formLocked}
                  onChange={set('deadlineDate')}
                  min={minDate()}
                  style={{
                    background: 'rgba(10,12,15,0.5)',
                    border: '1px solid var(--border2)',
                  }}
                />
              </div>
              <div>
                <label style={label}>Min rep score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.minRepScore}
                  disabled={formLocked}
                  onChange={set('minRepScore')}
                  placeholder="0"
                  style={{
                    background: 'rgba(10,12,15,0.5)',
                    border: '1px solid var(--border2)',
                  }}
                />
              </div>
            </div>

            {/* Budget breakdown with gradient */}
            {form.budgetXlm && parseFloat(form.budgetXlm) > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.9))',
                border: '1px solid rgba(0,229,160,0.2)',
                borderRadius: 'var(--r2)',
                padding: '14px 18px',
                marginBottom: 20,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                boxShadow: '0 0 20px rgba(0,229,160,0.05)',
              }}>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 0 8px rgba(0,229,160,0.5)',
                  }} />
                  Payment breakdown
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, paddingBottom: 6, borderBottom: '1px dashed rgba(30,40,48,0.6)' }}>
                  <span style={{ color: 'var(--text3)' }}>Escrow (total)</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>{parseFloat(form.budgetXlm).toFixed(4)} XLM</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text3)' }}>Agent receives (80%)</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{(parseFloat(form.budgetXlm) * 0.8).toFixed(4)} XLM</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text3)' }}>Platform fee (20%)</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{(parseFloat(form.budgetXlm) * 0.2).toFixed(4)} XLM</span>
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
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 8 }}>
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
                disabled={step === STEPS.signing || step === STEPS.preparing || step === STEPS.confirming}
                style={btn('secondary', step === STEPS.signing || step === STEPS.preparing || step === STEPS.confirming)}
                onMouseEnter={e => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border2)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {step === STEPS.sign_ready ? 'back' : 'cancel'}
              </button>
              {preparedXdr && (step === STEPS.sign_ready || step === STEPS.confirming) ? (
                <button
                  type="button"
                  onClick={submitSignAndFinish}
                  disabled={step === STEPS.confirming}
                  style={{
                    ...btn('primary', step === STEPS.confirming),
                    opacity: step === STEPS.confirming ? 0.6 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 0 30px rgba(0,229,160,0.5)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(0,229,160,0.3)';
                  }}
                >
                  {step === STEPS.confirming ? 'submitting...' : 'sign with wallet →'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitPrepare}
                  disabled={['signing', 'preparing', 'confirming'].includes(step)}
                  style={{
                    ...btn('primary', ['signing', 'preparing', 'confirming'].includes(step)),
                    opacity: ['signing', 'preparing', 'confirming'].includes(step) ? 0.6 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 0 30px rgba(0,229,160,0.5)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(0,229,160,0.3)';
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