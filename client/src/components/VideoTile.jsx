import { useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';

export default function VideoTile({ stream, name, local, mic, cam, sharing, small }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);

  const showVideo = !!stream && (sharing || cam);

  return (
    <figure className={`tile ${small ? 'small' : ''} ${sharing ? 'sharing' : ''}`}>
      {/* local video is muted so you don't hear yourself */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={local}
        className={local && !sharing ? 'mirror' : ''}
        style={{ visibility: showVideo ? 'visible' : 'hidden' }}
      />
      {!showVideo && (
        <div className="placeholder">
          <Avatar name={name} size={small ? 36 : 72} />
        </div>
      )}
      <figcaption>
        <span>{name}</span>
        {sharing && <span className="badge">Presenting</span>}
        {!mic && <span className="badge warn">Muted</span>}
      </figcaption>
    </figure>
  );
}
