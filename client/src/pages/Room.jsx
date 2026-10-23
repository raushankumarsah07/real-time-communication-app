import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useMeeting from '../hooks/useMeeting.js';
import VideoTile from '../components/VideoTile.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import FilesPanel from '../components/FilesPanel.jsx';
import Whiteboard from '../components/Whiteboard.jsx';

export default function Room() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const m = useMeeting(code);
  const [view, setView] = useState('meeting'); // meeting | board
  const [panel, setPanel] = useState('chat'); // chat | files | people | null
  const [copied, setCopied] = useState(false);

  if (m.status === 'error')
    return (
      <div className="auth">
        <div className="card center">
          <h2>Couldn't join this meeting</h2>
          <p className="error">{m.error}</p>
          <button className="btn" onClick={() => nav('/')}>Back to home</button>
        </div>
      </div>
    );
  if (m.status !== 'joined') return <p className="center muted pad">Joining meeting… allow camera and microphone if asked.</p>;

  const tiles = [
    { id: 'me', local: true, stream: m.localStream, name: `${user.name} (You)`, ...m.media },
    ...Object.entries(m.remotes).map(([id, r]) => ({
      id, stream: r.stream, name: r.user?.name || 'Guest',
      mic: r.mic !== false, cam: r.cam !== false, sharing: !!r.sharing,
    })),
  ];

  const togglePanel = (p) => setPanel((cur) => (cur === p ? null : p));

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const leave = () => nav('/');

  return (
    <div className="room">
      <header className="room-top">
        <div>
          <div className="strong">{m.room?.name}</div>
          <div className="muted small-text">{code} · {tiles.length} in meeting</div>
        </div>
        <div className="row">
          <span className="badge ok" title="Audio/video: DTLS-SRTP. Chat and files: AES-256-GCM at rest.">Encrypted</span>
          <button className="btn ghost small" onClick={copyLink}>{copied ? 'Link copied' : 'Copy invite link'}</button>
        </div>
      </header>

      <div className="room-main">
        <section className="stage">
          {view === 'board' && (
            <div className="strip">
              {tiles.map((t) => <VideoTile key={t.id} {...t} small />)}
            </div>
          )}
          {view === 'meeting' && (
            <div className="grid" data-count={tiles.length}>
              {tiles.map((t) => <VideoTile key={t.id} {...t} />)}
            </div>
          )}
          {/* kept mounted so drawings arriving while hidden are not lost */}
          <Whiteboard socket={m.socket} initialOps={m.initialBoard} hidden={view !== 'board'} />
        </section>

        {panel && (
          <aside className="side">
            <div className="side-head">
              <strong>{panel === 'chat' ? 'Chat' : panel === 'files' ? 'Shared files' : 'People'}</strong>
              <button className="link-btn" onClick={() => setPanel(null)}>Close</button>
            </div>
            {panel === 'chat' && <ChatPanel messages={m.messages} onSend={m.sendChat} />}
            {panel === 'files' && <FilesPanel code={code} files={m.files} />}
            {panel === 'people' && (
              <ul className="panel-body people">
                {tiles.map((t) => (
                  <li key={t.id}>{t.name}<span className="muted small-text">{t.mic ? 'Mic on' : 'Muted'}</span></li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      <footer className="controls">
        <button className={`ctl ${m.media.mic ? '' : 'off'}`} onClick={m.toggleMic}>{m.media.mic ? 'Mute' : 'Unmute'}</button>
        <button className={`ctl ${m.media.cam ? '' : 'off'}`} onClick={m.toggleCam}>{m.media.cam ? 'Camera off' : 'Camera on'}</button>
        <button className={`ctl ${m.media.sharing ? 'active' : ''}`} onClick={m.media.sharing ? m.stopShare : m.startShare}>
          {m.media.sharing ? 'Stop sharing' : 'Share screen'}
        </button>
        <button className={`ctl ${view === 'board' ? 'active' : ''}`} onClick={() => setView(view === 'board' ? 'meeting' : 'board')}>Whiteboard</button>
        <button className={`ctl ${panel === 'chat' ? 'active' : ''}`} onClick={() => togglePanel('chat')}>Chat</button>
        <button className={`ctl ${panel === 'files' ? 'active' : ''}`} onClick={() => togglePanel('files')}>Files</button>
        <button className={`ctl ${panel === 'people' ? 'active' : ''}`} onClick={() => togglePanel('people')}>People</button>
        <button className="ctl leave" onClick={leave}>Leave</button>
      </footer>
    </div>
  );
}
