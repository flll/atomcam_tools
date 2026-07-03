import { useEffect, useRef, useState } from 'react';
import { api } from '@/api';

export type WebRtcState = 'disabled' | 'connecting' | 'connected' | 'failed';

const MAX_ATTEMPTS = 2; // 初回 + 再試行1回。以後は JPEG フォールバックに任せる

// go2rtc の WHEP(POST /api/webrtc)で低遅延ストリームを受信する。
// LAN 直結前提のため STUN は使わない(ICE はホスト候補 + :8555/tcp)。
export function useWebRtcStream(enabled: boolean): {
  state: WebRtcState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
} {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // enabled=false 時は state を使わず 'disabled' を導出する(effect 内の同期 setState 回避)
  const [state, setState] = useState<WebRtcState>('connecting');

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    let attempts = 0;

    function cleanupPc() {
      if (pc) {
        pc.onconnectionstatechange = null;
        pc.ontrack = null;
        pc.close();
        pc = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function waitIceComplete(conn: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
      if (conn.iceGatheringState === 'complete') return;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        conn.addEventListener('icegatheringstatechange', () => {
          if (conn.iceGatheringState === 'complete') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }

    async function connect(): Promise<void> {
      attempts += 1;
      setState('connecting');

      if (!(await api.probeGo2rtc())) {
        if (!cancelled) setState('failed');
        return;
      }
      if (cancelled) return;

      const conn = new RTCPeerConnection();
      pc = conn;
      conn.addTransceiver('video', { direction: 'recvonly' });
      conn.addTransceiver('audio', { direction: 'recvonly' });

      conn.ontrack = (e) => {
        const stream = e.streams[0];
        if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
      };

      conn.onconnectionstatechange = () => {
        if (cancelled || pc !== conn) return;
        if (conn.connectionState === 'connected') {
          setState('connected');
        } else if (conn.connectionState === 'failed' || conn.connectionState === 'disconnected') {
          cleanupPc();
          if (attempts < MAX_ATTEMPTS) {
            connect().catch(() => setState('failed'));
          } else {
            setState('failed');
          }
        }
      };

      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      await waitIceComplete(conn);
      if (cancelled || pc !== conn) return;

      const answer = await api.whepOffer(conn.localDescription?.sdp ?? offer.sdp ?? '');
      if (cancelled || pc !== conn) return;
      await conn.setRemoteDescription({ type: 'answer', sdp: answer });
    }

    function start() {
      connect().catch(() => {
        if (cancelled) return;
        cleanupPc();
        if (attempts < MAX_ATTEMPTS) {
          start();
        } else {
          setState('failed');
        }
      });
    }

    // バックグラウンドタブでは切断し、復帰時に接続し直す
    function onVisibility() {
      if (document.hidden) {
        cleanupPc();
      } else if (!pc) {
        attempts = 0;
        start();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      cleanupPc();
    };
  }, [enabled]);

  return { state: enabled ? state : 'disabled', videoRef };
}
