import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { formatTime } from '../utils';

export default function ChatPanel({ messages, onSend }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="panel-body">
      <div className="chat-list">
        {messages.length === 0 && <p className="muted small-text">No messages yet. Messages are stored encrypted.</p>}
        {messages.map((m) => {
          const mine = m.user._id === user._id;
          return (
            <div key={m._id} className={`msg ${mine ? 'mine' : ''}`}>
              <div className="msg-meta">{mine ? 'You' : m.user.name} · {formatTime(m.createdAt)}</div>
              <div className="msg-text">{m.text}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} maxLength={2000} placeholder="Send a message" onChange={(e) => setText(e.target.value)} />
        <button className="btn small" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
