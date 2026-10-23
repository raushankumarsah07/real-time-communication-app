import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api, { errorMessage } from '../api';

// STUN finds each person's public address. Add a TURN server (see .env.example) for strict networks.
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(import.meta.env.VITE_TURN_URL
      ? [{
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        }]
      : []),
  ],
};

const videoSender = (pc) =>
  pc.getTransceivers().find((t) => t.receiver.track.kind === 'video')?.sender;

/**
 * Handles everything real-time for one meeting:
 *  - Socket.io connection (signalling, chat, file notices, whiteboard)
 *  - One RTCPeerConnection per other participant (mesh topology)
 *  - Camera / microphone / screen-share tracks
 */
export default function useMeeting(code) {
  const [status, setStatus] = useState('connecting'); // connecting | joined | error
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remotes, setRemotes] = useState({}); // socketId -> { user, stream, mic, cam, sharing }
  const [media, setMedia] = useState({ mic: false, cam: false, sharing: false });
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [initialBoard, setInitialBoard] = useState([]);

  const socketRef = useRef(null);
  const pcs = useRef({});
  const pendingIce = useRef({});
  const camStream = useRef(null);
  const screenStream = useRef(null);
  const mediaRef = useRef({ mic: false, cam: false, sharing: false });

  const updateMedia = useCallback((patch = {}) => {
    mediaRef.current = { ...mediaRef.current, ...patch };
    setMedia(mediaRef.current);
    socketRef.current?.emit('media-state', mediaRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const socket = io({ auth: { token: localStorage.getItem('token') } });
    socketRef.current = socket;

    const upsert = (id, patch) => setRemotes((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

    const removePeer = (id) => {
      pcs.current[id]?.close();
      delete pcs.current[id];
      delete pendingIce.current[id];
      setRemotes((r) => {
        const { [id]: _gone, ...rest } = r;
        return rest;
      });
    };

    function createPeer(id) {
      if (pcs.current[id]) return pcs.current[id];
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcs.current[id] = pc;
      pendingIce.current[id] = [];

      // Always negotiate one audio + one video line, even if we have no camera,
      // so we can start sending later (e.g. screen share) without renegotiating.
      for (const kind of ['audio', 'video']) {
        const track = camStream.current?.getTracks().find((t) => t.kind === kind);
        if (track) pc.addTrack(track, camStream.current);
        else pc.addTransceiver(kind, { direction: 'sendrecv' });
      }
      // if we are already sharing our screen, new joiners should see it
      const screenTrack = screenStream.current?.getVideoTracks()[0];
      if (screenTrack) videoSender(pc)?.replaceTrack(screenTrack);

      const remoteStream = new MediaStream();
      pc.ontrack = (e) => {
        remoteStream.addTrack(e.track);
        upsert(id, { stream: remoteStream });
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('signal', { to: id, data: { candidate: e.candidate } });
      };
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) removePeer(id);
      };
      return pc;
    }

    async function callPeer(id) {
      const pc = createPeer(id);
      await pc.setLocalDescription(await pc.createOffer());
      socket.emit('signal', { to: id, data: { sdp: pc.localDescription } });
    }

    socket.on('connect_error', (err) => {
      setError(err.message);
      setStatus('error');
    });

    socket.on('peer-joined', ({ socketId, user }) => {
      upsert(socketId, { user, mic: true, cam: true });
      socket.emit('media-state', mediaRef.current); // let the newcomer know our mic/camera state
    });
    socket.on('peer-left', ({ socketId }) => removePeer(socketId));
    socket.on('media-state', ({ socketId, state }) => upsert(socketId, state));

    // Offer / answer / ICE candidates relayed by the server
    socket.on('signal', async ({ from, data }) => {
      try {
        const pc = createPeer(from);
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          for (const c of pendingIce.current[from] || []) await pc.addIceCandidate(c);
          pendingIce.current[from] = [];
          if (data.sdp.type === 'offer') {
            await pc.setLocalDescription(await pc.createAnswer());
            socket.emit('signal', { to: from, data: { sdp: pc.localDescription } });
          }
        } else if (data.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
          else pendingIce.current[from].push(data.candidate);
        }
      } catch (e) {
        console.error('signalling error', e);
      }
    });

    socket.on('chat-message', (m) => setMessages((list) => [...list, m]));
    socket.on('file-shared', (f) => setFiles((list) => (list.some((x) => x._id === f._id) ? list : [f, ...list])));

    (async () => {
      // 1. camera + microphone (fall back to audio-only, then to watch-only)
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { stream = null; }
      }
      if (cancelled) return stream?.getTracks().forEach((t) => t.stop());
      camStream.current = stream;
      setLocalStream(stream);
      mediaRef.current = {
        mic: !!stream?.getAudioTracks().length,
        cam: !!stream?.getVideoTracks().length,
        sharing: false,
      };
      setMedia(mediaRef.current);

      // 2. join the meeting (REST registers us as a participant, then the socket joins the live room)
      try {
        const { data } = await api.post(`/rooms/${code}/join`);
        const [msgs, fls] = await Promise.all([
          api.get(`/rooms/${code}/messages`),
          api.get(`/rooms/${code}/files`),
        ]);
        if (cancelled) return;
        setRoom(data);
        setMessages(msgs.data);
        setFiles(fls.data);
      } catch (err) {
        if (!cancelled) { setError(errorMessage(err)); setStatus('error'); }
        return;
      }

      socket.emit('join-room', { code }, (res) => {
        if (cancelled) return;
        if (res.error) { setError(res.error); setStatus('error'); return; }
        setInitialBoard(res.board);
        // we are the newcomer, so we start the call with everyone already inside
        res.peers.forEach((p) => {
          setRemotes((r) => ({ ...r, [p.socketId]: { ...r[p.socketId], user: p.user, mic: true, cam: true } }));
          callPeer(p.socketId);
        });
        socket.emit('media-state', mediaRef.current);
        setStatus('joined');
      });
    })();

    return () => {
      cancelled = true;
      socket.disconnect();
      Object.values(pcs.current).forEach((pc) => pc.close());
      pcs.current = {};
      camStream.current?.getTracks().forEach((t) => t.stop());
      screenStream.current?.getTracks().forEach((t) => t.stop());
      camStream.current = screenStream.current = null;
    };
  }, [code]);

  const toggleMic = useCallback(() => {
    const track = camStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    updateMedia({ mic: track.enabled });
  }, [updateMedia]);

  const toggleCam = useCallback(() => {
    const track = camStream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    updateMedia({ cam: track.enabled });
  }, [updateMedia]);

  const stopShare = useCallback(() => {
    const s = screenStream.current;
    if (!s) return;
    s.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    const camTrack = camStream.current?.getVideoTracks()[0] || null;
    Object.values(pcs.current).forEach((pc) => videoSender(pc)?.replaceTrack(camTrack));
    setLocalStream(camStream.current);
    updateMedia({ sharing: false });
  }, [updateMedia]);

  const startShare = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = s.getVideoTracks()[0];
      screenStream.current = s;
      // swap the outgoing video track on every connection (no renegotiation needed)
      await Promise.all(Object.values(pcs.current).map((pc) => videoSender(pc)?.replaceTrack(track)));
      track.onended = stopShare; // user clicked the browser's "Stop sharing" bar
      setLocalStream(new MediaStream([track, ...(camStream.current?.getAudioTracks() || [])]));
      updateMedia({ sharing: true });
    } catch {
      /* user cancelled the picker */
    }
  }, [stopShare, updateMedia]);

  const sendChat = useCallback((text) => socketRef.current?.emit('chat-message', { text }), []);

  return {
    status, error, room, localStream, remotes, media, messages, files, setFiles, initialBoard,
    socket: socketRef.current,
    toggleMic, toggleCam, startShare, stopShare, sendChat,
  };
}
