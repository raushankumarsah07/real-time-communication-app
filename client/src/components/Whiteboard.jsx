import { useCallback, useEffect, useRef, useState } from 'react';

const W = 1280;
const H = 720;
const COLORS = ['#1c2540', '#e5484d', '#f08c00', '#2f9e44', '#1c7ed6', '#9c36b5'];

// Coordinates are sent as fractions (0–1) so every screen size sees the same drawing.
export default function Whiteboard({ socket, initialOps, hidden }) {
  const canvasRef = useRef(null);
  const last = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(4);

  const ctx = () => canvasRef.current.getContext('2d');

  const paint = useCallback((op) => {
    const c = ctx();
    if (op.t === 'seg') {
      c.strokeStyle = op.c;
      c.lineWidth = op.w;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(op.x1 * W, op.y1 * H);
      c.lineTo(op.x2 * W, op.y2 * H);
      c.stroke();
    } else if (op.t === 'text') {
      c.fillStyle = op.c;
      c.font = `600 ${op.s}px Figtree, sans-serif`;
      c.textBaseline = 'top';
      c.fillText(op.text, op.x * W, op.y * H);
    }
  }, []);

  const wipe = () => {
    const c = ctx();
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
  };

  // replay what was already drawn before we joined
  useEffect(() => {
    wipe();
    initialOps.forEach(paint);
  }, [initialOps, paint]);

  useEffect(() => {
    if (!socket) return;
    socket.on('wb-op', paint);
    socket.on('wb-clear', wipe);
    return () => { socket.off('wb-op', paint); socket.off('wb-clear', wipe); };
  }, [socket, paint]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const send = (op) => { paint(op); socket.emit('wb-op', op); };

  const segment = (a, b) => ({
    t: 'seg',
    c: tool === 'eraser' ? '#ffffff' : color,
    w: tool === 'eraser' ? size * 4 : size,
    x1: a.x, y1: a.y, x2: b.x, y2: b.y,
  });

  const down = (e) => {
    const p = pos(e);
    if (tool === 'text') {
      const text = window.prompt('Type your text');
      if (text?.trim()) send({ t: 'text', c: color, s: 16 + size * 4, x: p.x, y: p.y, text });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = p;
    send(segment(p, p)); // a single click leaves a dot
  };
  const move = (e) => {
    if (!last.current) return;
    const p = pos(e);
    send(segment(last.current, p));
    last.current = p;
  };
  const up = () => { last.current = null; };

  const clear = () => {
    if (!window.confirm('Clear the whiteboard for everyone?')) return;
    wipe();
    socket.emit('wb-clear');
  };

  const save = () => {
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = 'whiteboard.png';
    a.click();
  };

  return (
    <div className="board" hidden={hidden}>
      <div className="board-tools">
        {['pen', 'text', 'eraser'].map((t) => (
          <button key={t} className={`chip ${tool === t ? 'on' : ''}`} onClick={() => setTool(t)}>
            {t === 'pen' ? 'Pen' : t === 'text' ? 'Text' : 'Eraser'}
          </button>
        ))}
        <span className="sep" />
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${color === c && tool !== 'eraser' ? 'on' : ''}`}
            style={{ background: c }}
            aria-label={`Colour ${c}`}
            onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
          />
        ))}
        <span className="sep" />
        <label className="size">
          Size
          <input type="range" min="2" max="20" value={size} onChange={(e) => setSize(+e.target.value)} />
        </label>
        <span className="grow" />
        <button className="chip" onClick={save}>Save PNG</button>
        <button className="chip danger" onClick={clear}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  );
}
