import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/rooms').then((r) => setRooms(r.data)); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/rooms', { name });
      nav(`/room/${data.code}`);
    } catch (err) { setError(errorMessage(err)); }
  };

  const join = (e) => {
    e.preventDefault();
    // accept a pasted link or a bare code
    const c = code.trim().split('/').pop().toLowerCase();
    if (c) nav(`/room/${c}`);
  };

  return (
    <>
      <header className="topnav">
        <span className="logo">meetly</span>
        <div className="row">
          <span className="muted">{user.name}</span>
          <button className="btn ghost small" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="container">
        <div className="dashboard-hero">
          <div>
            <div className="eyebrow">YOUR WORKSPACE</div>
            <h1 className="hello">Hi {user.name.split(' ')[0]},<br /><span>ready to meet?</span></h1>
            <p className="muted hero-copy">Your space for focused conversations, bold ideas and real connection.</p>
          </div>
          <div className="hero-orb" aria-hidden="true"><div className="orb-core">M</div><span className="orb-ring ring-a" /><span className="orb-ring ring-b" /></div>
        </div>
        {error && <p className="error">{error}</p>}

        <div className="two-col">
          <form className="card" onSubmit={create}>
            <h2>Start a meeting</h2>
            <label>Meeting name
              <input value={name} maxLength={80} placeholder="Weekly sync" onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="btn wide">Create meeting</button>
          </form>

          <form className="card" onSubmit={join}>
            <h2>Join with a code</h2>
            <label>Meeting code or link
              <input value={code} placeholder="abc-defg-hij" onChange={(e) => setCode(e.target.value)} />
            </label>
            <button className="btn ghost wide" disabled={!code.trim()}>Join meeting</button>
          </form>
        </div>

        <div className="section-heading">
          <h2>Your meetings</h2>
          <span className="badge">{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</span>
        </div>
        {rooms.length === 0 && <div className="card muted center">No meetings yet. Create one to get started.</div>}
        {rooms.map((r) => (
          <div className="card row between" key={r.code}>
            <div>
              <div className="strong">{r.name}</div>
              <div className="muted small-text">{r.code}{r.isHost ? ' · you are the host' : ''}</div>
            </div>
            <button className="btn small" onClick={() => nav(`/room/${r.code}`)}>Join</button>
          </div>
        ))}
      </main>
    </>
  );
}
