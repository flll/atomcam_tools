// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebRtcStream } from './useWebRtcStream';

const mocks = vi.hoisted(() => ({
  probeGo2rtc: vi.fn(() => Promise.resolve(true)),
  whepOffer: vi.fn(() => Promise.resolve('v=0 answer')),
}));

vi.mock('@/api', () => ({
  api: { probeGo2rtc: mocks.probeGo2rtc, whepOffer: mocks.whepOffer },
}));

const instances: FakePeerConnection[] = [];

class FakePeerConnection {
  iceGatheringState = 'complete';
  connectionState = 'new';
  localDescription: { sdp: string } | null = null;
  remoteDescription: { sdp: string } | null = null;
  ontrack: ((e: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  closed = false;

  constructor() {
    instances.push(this);
  }

  addTransceiver() {}
  addEventListener() {}
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'v=0 offer' });
  }
  setLocalDescription(desc: { sdp: string }) {
    this.localDescription = desc;
    return Promise.resolve();
  }
  setRemoteDescription(desc: { sdp: string }) {
    this.remoteDescription = desc;
    return Promise.resolve();
  }
  close() {
    this.closed = true;
  }

  fireConnectionState(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

describe('useWebRtcStream', () => {
  beforeEach(() => {
    instances.length = 0;
    mocks.probeGo2rtc.mockClear();
    mocks.probeGo2rtc.mockImplementation(() => Promise.resolve(true));
    mocks.whepOffer.mockClear();
    mocks.whepOffer.mockImplementation(() => Promise.resolve('v=0 answer'));
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enabled=false では disabled のまま接続しない', () => {
    const { result } = renderHook(() => useWebRtcStream(false));
    expect(result.current.state).toBe('disabled');
    expect(mocks.probeGo2rtc).not.toHaveBeenCalled();
  });

  it('probe 失敗で failed になる(JPEG フォールバック経路)', async () => {
    mocks.probeGo2rtc.mockImplementation(() => Promise.resolve(false));
    const { result } = renderHook(() => useWebRtcStream(true));
    await waitFor(() => expect(result.current.state).toBe('failed'));
    expect(instances).toHaveLength(0);
  });

  it('WHEP 交換 → connected 遷移', async () => {
    const { result } = renderHook(() => useWebRtcStream(true));
    expect(result.current.state).toBe('connecting');

    await waitFor(() => expect(mocks.whepOffer).toHaveBeenCalledWith('v=0 offer'));
    await waitFor(() => expect(instances[0].remoteDescription?.sdp).toBe('v=0 answer'));

    act(() => instances[0].fireConnectionState('connected'));
    expect(result.current.state).toBe('connected');
  });

  it('切断 → 1回再試行 → 失敗で failed', async () => {
    const { result } = renderHook(() => useWebRtcStream(true));
    await waitFor(() => expect(instances).toHaveLength(1));

    act(() => instances[0].fireConnectionState('failed'));
    await waitFor(() => expect(instances).toHaveLength(2));
    expect(instances[0].closed).toBe(true);

    await waitFor(() => expect(instances[1].remoteDescription).not.toBeNull());
    act(() => instances[1].fireConnectionState('failed'));
    await waitFor(() => expect(result.current.state).toBe('failed'));
    expect(instances).toHaveLength(2);
  });

  it('アンマウントで接続を閉じる', async () => {
    const { unmount } = renderHook(() => useWebRtcStream(true));
    await waitFor(() => expect(instances).toHaveLength(1));
    unmount();
    expect(instances[0].closed).toBe(true);
  });
});
