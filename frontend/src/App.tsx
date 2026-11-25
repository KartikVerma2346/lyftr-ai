
import { useEffect, useState } from 'react'
import './App.css'
import { createChat, getChats, getChat, saveMessage } from './api'

type Message = {
  id?: number
  role: 'user' | 'assistant'
  content: string
}

type Chat = {
  id: number
  title: string
}

const suggestions = [
  { icon: '✦', title: 'Write something', description: 'Draft emails, stories and content' },
  { icon: '⌘', title: 'Write code', description: 'Generate and explain code' },
  { icon: '◎', title: 'Learn something', description: 'Understand complex topics easily' },
  { icon: '⌕', title: 'Analyze data', description: 'Explore insights and patterns' },
]

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('GPT-4o')
  const [history, setHistory] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function refreshChats() {
    const chats = await getChats()
    setHistory(chats)
  }

  useEffect(() => {
    refreshChats().catch(() => {
      setError('Could not connect to the backend.')
    })
  }, [])

  async function openChat(id: number) {
    setLoading(true)
    setError('')

    try {
      const chat = await getChat(id)
      setActiveChatId(chat.id)
      setMessages(chat.messages)
    } catch {
      setError('Could not load this conversation.')
    } finally {
      setLoading(false)
    }
  }

  function newChat() {
    setActiveChatId(null)
    setMessages([])
    setPrompt('')
    setError('')
  }


  async function sendMessage() {
    const content = prompt.trim()

    if (!content || sending) return

    setSending(true)
    setError('')

    let messageSaved = false

    try {
      let chatId = activeChatId

      if (chatId === null) {
        const newConversation = await createChat()
        chatId = newConversation.id
        setActiveChatId(chatId)
      }

      const savedMessage = await saveMessage(
        chatId,
        'user',
        content
      )

      messageSaved = true
      setMessages(previous => [...previous, savedMessage])
      setPrompt('')

      const response = await fetch(
        `http://localhost:8000/chats/${chatId}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'AI response failed')
      }

      setMessages(previous => [...previous, data])

      await refreshChats()

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Unknown error'

      if (messageSaved) {
        setError(`Message saved, but AI response failed: ${message}`)
      } else {
        setError(`Message could not be saved: ${message}`)
      }
    } finally {
      setSending(false)
    }
  }


  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <span>lumina<span className="brand-dot">.</span></span>
        </div>

        <button className="new-chat" onClick={newChat}>
          <span>＋</span> New conversation
        </button>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="nav-links">
          <button className="nav-item active">◈ <span>Chat</span></button>
          <button className="nav-item">▤ <span>History</span></button>
          <button className="nav-item">▦ <span>Explore models</span></button>
          <button className="nav-item">◷ <span>Usage analytics</span></button>
        </nav>

        <div className="history-heading">
          <span>RECENT CHATS</span>
          <span>•••</span>
        </div>

        <div className="history-list">
          {history.slice(0, 8).map(chat => (
            <button
              className="history-item"
              key={chat.id}
              onClick={() => openChat(chat.id)}
              style={{
                background: activeChatId === chat.id ? '#f0edff' : 'transparent'
              }}
            >
              <span>▢</span>
              <span className="history-text">{chat.title}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="avatar">K</div>
          <div className="profile-info">
            <strong>My Account</strong>
            <span>Free plan</span>
          </div>
          <span className="profile-menu">•••</span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> AI Chat</div>
          <div className="topbar-right">
            <span className="status-dot"></span>
            <span>All systems operational</span>
            <button className="top-icon">⚙</button>
          </div>
        </header>

        <section className="chat-area">
          {loading ? (
            <div className="welcome">
              <p>Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-symbol">✦</div>
              <div className="eyebrow">YOUR AI WORKSPACE</div>
              <h1>Ideas start here<span>.</span></h1>
              <p>
                A little curiosity can take you a long way.
                <br />
                What would you like to explore today?
              </p>

              <div className="suggestion-grid">
                {suggestions.map(item => (
                  <button
                    className="suggestion-card"
                    key={item.title}
                    onClick={() => setPrompt(item.title + ': ')}
                  >
                    <span className="suggestion-icon">{item.icon}</span>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message, index) => (
                <div className={`message ${message.role}`} key={message.id ?? index}>
                  <div className="message-avatar">
                    {message.role === 'user' ? 'K' : '✦'}
                  </div>
                  <div className="message-content">
                    <strong>{message.role === 'user' ? 'You' : 'Lumina AI'}</strong>
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}

            </div>
          )}
        </section>

        <footer className="composer-section">
          {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

          <div className="composer">
            <textarea
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask anything, explore everything..."
              rows={2}
              disabled={sending}
            />

            <div className="composer-bottom">
              <div className="model-selector">
                <span>✦</span>
                <select value={model} onChange={event => setModel(event.target.value)}>
                  <option>GPT-4o</option>
                  <option>Claude</option>
                  <option>Gemini</option>
                </select>
                <span>⌄</span>
              </div>

              <button
                className="send-button"
                onClick={sendMessage}
                disabled={!prompt.trim() || sending}
              >
                {sending ? '...' : '↑'}
              </button>
            </div>
          </div>
          <p className="disclaimer">
            Lumina AI can make mistakes. Verify important information.
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
