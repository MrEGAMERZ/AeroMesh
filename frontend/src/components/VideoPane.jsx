// VideoPane: a simple HTML5 video player that fires onTimeUpdate
import React, { useRef, useEffect } from 'react';

export default function VideoPane({ videoUrl, onTimeUpdate }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => onTimeUpdate && onTimeUpdate(video.currentTime);
    video.addEventListener('timeupdate', handler);
    return () => video.removeEventListener('timeupdate', handler);
  }, [onTimeUpdate]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: '#1a1a2e', color: '#7ecfff', fontSize: 12, fontFamily: 'monospace' }}>
        DRONE VIDEO FEED
      </div>
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          style={{ flex: 1, width: '100%', objectFit: 'contain' }}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 32 }}>🎥</div>
          <div style={{ fontSize: 13, color: '#666' }}>No video loaded</div>
          <div style={{ fontSize: 11, color: '#444' }}>Upload a flight to see synchronized video</div>
        </div>
      )}
    </div>
  );
}
