import { describe, expect, it } from 'vitest';
import { frigateSnippet, homeAssistantSnippet, maskAuthKey, rtspUrl, tailscaleAclSnippet, webrtcPageUrl } from './integration-snippets';

const noAuth = { on: false, user: '', pass: '' };
const auth = { on: true, user: 'cam', pass: 'secret' };

describe('rtspUrl', () => {
  it('実パス videoN_unicast を使う(/videoN は実機で 404)', () => {
    expect(rtspUrl('atomcam.local', 'video0', noAuth)).toBe('rtsp://atomcam.local:8554/video0_unicast');
    expect(rtspUrl('10.0.0.228', 'video1', noAuth)).toBe('rtsp://10.0.0.228:8554/video1_unicast');
  });

  it('認証ありでは user:pass@ を含める', () => {
    expect(rtspUrl('h', 'video2', auth)).toBe('rtsp://cam:secret@h:8554/video2_unicast');
  });

  it('認証 on でもユーザー名が空なら資格情報を付けない', () => {
    expect(rtspUrl('h', 'video0', { on: true, user: '', pass: 'x' })).toBe('rtsp://h:8554/video0_unicast');
  });
});

describe('frigateSnippet', () => {
  it('検知=サブ(video1)・録画=メイン(video0)の2ロール構成を生成する', () => {
    const s = frigateSnippet('atomcam.local', 'atomcam', noAuth);
    expect(s).toContain('rtsp://atomcam.local:8554/video0_unicast');
    expect(s).toContain('rtsp://atomcam.local:8554/video1_unicast');
    expect(s).toContain('- record');
    expect(s).toContain('- detect');
    // detect ロールはサブ(_sub)ストリーム側
    const detectIdx = s.indexOf('- detect');
    const subPathIdx = s.indexOf('atomcam_sub\n          input_args');
    expect(subPathIdx).toBeGreaterThan(-1);
    expect(detectIdx).toBeGreaterThan(subPathIdx);
    expect(s).toContain('width: 640');
  });

  it('認証情報が URL に埋め込まれる', () => {
    expect(frigateSnippet('h', 'cam1', auth)).toContain('rtsp://cam:secret@h:8554/video0_unicast');
  });
});

describe('homeAssistantSnippet / webrtcPageUrl', () => {
  it('go2rtc streams とメイン URL を含む', () => {
    const s = homeAssistantSnippet('h', 'atomcam', noAuth);
    expect(s).toContain('streams:');
    expect(s).toContain('rtsp://h:8554/video0_unicast');
  });

  it('WebRTC ページ URL は go2rtc の 1984 番', () => {
    expect(webrtcPageUrl('h')).toBe('http://h:1984/webrtc.html?src=video0');
  });
});

describe('maskAuthKey', () => {
  it('接頭辞と末尾4桁だけ残す', () => {
    expect(maskAuthKey('tskey-auth-abcdef12345-ZZZZ1a2b')).toBe('tskey-auth-••••1a2b');
  });
  it('空なら空', () => {
    expect(maskAuthKey('')).toBe('');
  });
  it('短すぎる文字列は全マスク', () => {
    expect(maskAuthKey('abc')).toBe('••••');
  });
});

describe('tailscaleAclSnippet', () => {
  it('指定タグに 80/8554 を許可する grants を生成', () => {
    const s = tailscaleAclSnippet('tag:cctv');
    expect(s).toContain('"tag:cctv"');
    expect(s).toContain('"80"');
    expect(s).toContain('"8554"');
    expect(s).toContain('grants');
    expect(s).toContain('tagOwners');
  });
  it('tag: が付いていない入力は tag:cctv に既定化', () => {
    expect(tailscaleAclSnippet('foo')).toContain('"tag:cctv"');
  });
});
