import { useRef, useState } from 'react';
import api, { errorMessage } from '../api';
import { formatSize, formatTime } from '../utils';

export default function FilesPanel({ code, files }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const upload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const body = new FormData();
    body.append('file', file);
    try {
      setProgress(0);
      await api.post(`/rooms/${code}/files`, body, {
        onUploadProgress: (p) => setProgress(Math.round((p.loaded / (p.total || file.size)) * 100)),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProgress(null);
    }
  };

  // Files are fetched with the auth header, then saved from memory
  const download = async (f) => {
    try {
      const res = await api.get(`/files/${f._id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="panel-body">
      <input ref={inputRef} type="file" hidden onChange={upload} />
      <button className="btn wide" onClick={() => inputRef.current.click()} disabled={progress !== null}>
        {progress !== null ? `Uploading… ${progress}%` : 'Share a file'}
      </button>
      <p className="muted small-text">Up to 25 MB. Files are encrypted on the server (AES-256-GCM).</p>
      {error && <p className="error">{error}</p>}

      <ul className="file-list">
        {files.length === 0 && <li className="muted small-text">No files shared yet.</li>}
        {files.map((f) => (
          <li key={f._id}>
            <div>
              <div className="file-name">{f.name}</div>
              <div className="muted small-text">{formatSize(f.size)} · {f.uploader?.name} · {formatTime(f.createdAt)}</div>
            </div>
            <button className="btn ghost small" onClick={() => download(f)}>Download</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
