import { useState, useRef, useCallback } from 'react'

// ── Read the backend URL from Vite env vars.
// In production (Vercel) set VITE_API_URL to your Render backend URL.
// In development the Vite proxy forwards /chat → localhost:9999.
const API_BASE = import.meta.env.VITE_API_URL || ''

const MODEL_NAMES_GROQ  = ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768']
const MODEL_NAMES_OPENAI = ['gpt-4o-mini']

// Generate a UUID v4 (used for session memory)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function App() {
  // ── Session ID — generated once per page load, mirrors st.session_state.session_id
  const sessionId = useRef(generateUUID()).current
  const shortId    = sessionId.slice(0, 8)

  // ── Form state
  const [systemPrompt,   setSystemPrompt]   = useState('')
  const [provider,       setProvider]       = useState('Groq')
  const [selectedModel,  setSelectedModel]  = useState(MODEL_NAMES_GROQ[0])
  const [allowWebSearch, setAllowWebSearch] = useState(false)
  const [userQuery,      setUserQuery]      = useState('')

  // ── Response / UI state
  const [responseText, setResponseText] = useState('')
  const [isStreaming,  setIsStreaming]  = useState(false)
  const [alertMsg,     setAlertMsg]     = useState(null) // { type: 'warning'|'error', text }
  const abortRef = useRef(null)

  // ── Provider change → reset model to first of new list
  const handleProviderChange = (p) => {
    setProvider(p)
    setSelectedModel(p === 'Groq' ? MODEL_NAMES_GROQ[0] : MODEL_NAMES_OPENAI[0])
  }

  // ── Main submit handler
  const handleSubmit = useCallback(async () => {
    setAlertMsg(null)

    if (!userQuery.trim()) {
      setAlertMsg({ type: 'warning', text: 'Please enter a query before clicking Ask Agent!' })
      return
    }

    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setResponseText('')
    setIsStreaming(true)

    const payload = {
      model_name:     selectedModel,
      model_provider: provider,
      system_prompt:  systemPrompt,
      messages:       [userQuery],
      allow_search:   allowWebSearch,
      session_id:     sessionId,
    }

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      })

      if (res.status === 422) {
        const detail = await res.text()
        setAlertMsg({ type: 'error', text: `Validation Error: Did you forget a field? Details: ${detail}` })
        setIsStreaming(false)
        return
      }

      if (!res.ok) {
        const detail = await res.text()
        setAlertMsg({ type: 'error', text: `Backend error: ${res.status} — ${detail}` })
        setIsStreaming(false)
        return
      }

      // ── Stream the response token by token (mirrors st.write_stream)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setResponseText(prev => prev + chunk)
      }

    } catch (err) {
      if (err.name === 'AbortError') return // user cancelled — silent
      if (err.message.includes('fetch') || err.message.includes('Failed')) {
        setAlertMsg({
          type: 'error',
          text: 'Cannot connect to backend. Make sure your FastAPI backend is running on port 9999.',
        })
      } else {
        setAlertMsg({ type: 'error', text: `Unexpected error: ${err.message}` })
      }
    } finally {
      setIsStreaming(false)
    }
  }, [selectedModel, provider, systemPrompt, userQuery, allowWebSearch, sessionId])

  // ── Key handler: Ctrl+Enter submits
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit()
  }

  const modelList = provider === 'Groq' ? MODEL_NAMES_GROQ : MODEL_NAMES_OPENAI

  return (
    <div className="app-wrapper">
      <div className="app-container">

        {/* ── HEADER ── */}
        <header className="app-header">
          <div className="badge">
            <span>⚡</span> LangGraph Powered
          </div>
          <h1>AI Chatbot Agents 🤖</h1>
          <p className="subtitle">
            Create and Interact with the AI Agents!
            <span className="session-tag">Session: {shortId}</span>
          </p>
        </header>

        {/* ── CONFIGURATION CARD ── */}
        <div className="glass-card">

          {/* System Prompt */}
          <div className="form-group">
            <label htmlFor="system-prompt">Define your AI Agent:</label>
            <textarea
              id="system-prompt"
              rows={3}
              placeholder="Type your system prompt here..."
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
            />
          </div>

          {/* Provider Radio */}
          <div className="form-group">
            <label>Select Provider:</label>
            <div className="radio-group">
              {['Groq', 'OpenAI'].map(p => (
                <div className="radio-option" key={p}>
                  <input
                    type="radio"
                    id={`provider-${p}`}
                    name="provider"
                    value={p}
                    checked={provider === p}
                    onChange={() => handleProviderChange(p)}
                  />
                  <label htmlFor={`provider-${p}`}>
                    <span className="radio-dot" />
                    {p === 'Groq' ? '⚡ Groq' : '🧠 OpenAI'}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Model Dropdown */}
          <div className="form-group">
            <label htmlFor="model-select">Select {provider} Model:</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
            >
              {modelList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Web Search Toggle */}
          <div className="form-group">
            <label>Options:</label>
            <div
              className={`toggle-row${allowWebSearch ? ' active' : ''}`}
              onClick={() => setAllowWebSearch(v => !v)}
              role="checkbox"
              aria-checked={allowWebSearch}
              tabIndex={0}
              onKeyDown={e => e.key === ' ' && setAllowWebSearch(v => !v)}
              id="web-search-toggle"
            >
              <span className="toggle-label-text">
                <span className="toggle-icon">🔍</span>
                Allow Web Search
              </span>
              <div className={`toggle-switch${allowWebSearch ? ' on' : ''}`} />
            </div>
          </div>
        </div>

        {/* ── QUERY CARD ── */}
        <div className="glass-card">
          <div className="form-group">
            <label htmlFor="user-query">Enter your query:</label>
            <textarea
              id="user-query"
              rows={5}
              placeholder="Ask Anything! (Ctrl+Enter to submit)"
              value={userQuery}
              onChange={e => setUserQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Alert (warning / error) */}
          {alertMsg && (
            <div className={`alert alert-${alertMsg.type}`}>
              <span className="alert-icon">
                {alertMsg.type === 'warning' ? '⚠️' : '❌'}
              </span>
              {alertMsg.text}
            </div>
          )}

          {/* Submit Button */}
          <button
            id="ask-agent-btn"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isStreaming}
          >
            <span className="btn-inner">
              {isStreaming ? (
                <>
                  <span>Agent is thinking</span>
                  <span className="loading-dots">
                    <span /><span /><span />
                  </span>
                </>
              ) : (
                <>🚀 Ask Agent!</>
              )}
            </span>
          </button>
        </div>

        {/* ── RESPONSE CARD ── */}
        {(responseText || isStreaming) && (
          <div className="response-card">
            <div className="response-header">
              <div className="agent-avatar">🤖</div>
              <h3>Agent Response</h3>
              {isStreaming && (
                <div className="streaming-indicator">
                  <div className="pulse" />
                  Streaming…
                </div>
              )}
            </div>
            <div className="response-body">
              {responseText}
              {isStreaming && <span className="cursor" />}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
