import { describe, expect, it } from 'vitest';
import {
  parseIspSettings,
  parseKeyValue,
  parseMediaSize,
  parseMotorPos,
  parseProperty,
  parseStorageDu,
  parseStorageInfo,
  parseWatermarkDimensions,
  rgbaToBgra,
} from './parse';

describe('parseStorageInfo', () => {
  it('マウント/df/swap/メモリを読み取る(MemAvailable なしは MemFree+Cached)', () => {
    const info = parseStorageInfo(
      [
        'MOUNTED=1',
        'MOUNTDEV=/dev/mmcblk0p1',
        'MOUNTFS=vfat',
        'MOUNTOPT=rw,relatime,fmask=0000',
        'DF=100 60 40',
        'SWAP1=/dev/zram0 65532 1024',
        'SWAP2=/media/mmc/.swapfile 131068 0',
        'MEMTOTAL=59404',
        'MEMFREE=6000',
        'CACHED=18000',
      ].join('\n'),
    );
    expect(info.mounted).toBe(true);
    expect(info.rw).toBe(true);
    expect(info.fs).toBe('vfat');
    expect(info.df).toEqual({ totalKb: 100, usedKb: 60, availKb: 40 });
    expect(info.swaps).toEqual([
      { name: '/dev/zram0', sizeKb: 65532, usedKb: 1024 },
      { name: '/media/mmc/.swapfile', sizeKb: 131068, usedKb: 0 },
    ]);
    expect(info.memTotalKb).toBe(59404);
    expect(info.memAvailKb).toBe(24000);
  });

  it('MemAvailable があればそれを優先する', () => {
    const info = parseStorageInfo('MOUNTED=0\nMEMTOTAL=1000\nMEMAVAILABLE=321\nMEMFREE=1');
    expect(info.mounted).toBe(false);
    expect(info.memAvailKb).toBe(321);
  });

  it('ro マウントを検知する', () => {
    const info = parseStorageInfo('MOUNTED=1\nMOUNTDEV=/dev/x\nMOUNTFS=vfat\nMOUNTOPT=ro,relatime\nDF=1 1 0');
    expect(info.rw).toBe(false);
  });
});

describe('parseStorageDu', () => {
  it('DU_ キーだけを読み取る', () => {
    expect(parseStorageDu('DU_record=100\nDU_time_lapse=5\nJUNK=1')).toEqual({
      record: 100,
      time_lapse: 5,
    });
  });
});

describe('parseKeyValue', () => {
  it('スペース区切り・=区切り・タブ区切りを受け付ける', () => {
    const kv = parseKeyValue('A 1\nB=2\nC\t3\n\n');
    expect(kv).toEqual({ A: '1', B: '2', C: '3' });
  });

  it('値に = を含む行を壊さない', () => {
    const kv = parseKeyValue('WEBHOOK_URL=https://example.com/hook?a=b&c=d');
    expect(kv.WEBHOOK_URL).toBe('https://example.com/hook?a=b&c=d');
  });

  it('値が空のキーも保持する', () => {
    expect(parseKeyValue('EMPTY=')).toEqual({ EMPTY: '' });
  });
});

describe('parseMotorPos', () => {
  it('pan/tilt/スイッチを読み取り丸める', () => {
    expect(parseMotorPos('10.6 20.2 1 0')).toEqual({ pan: 11, tilt: 20, horSwitch: 1, verSwitch: 0 });
  });

  it('スイッチ省略時は 0', () => {
    expect(parseMotorPos('5 8')).toEqual({ pan: 5, tilt: 8, horSwitch: 0, verSwitch: 0 });
  });

  it('不正・不足は null', () => {
    expect(parseMotorPos(undefined)).toBeNull();
    expect(parseMotorPos('abc def')).toBeNull();
    expect(parseMotorPos('42')).toBeNull();
  });
});

describe('parseMediaSize', () => {
  it('KB 値をバイトへ換算する', () => {
    expect(parseMediaSize('100 200')).toEqual({ available: 102400, total: 204800 });
  });

  it('不正は null', () => {
    expect(parseMediaSize(undefined)).toBeNull();
    expect(parseMediaSize('x y')).toBeNull();
  });
});

describe('parseIspSettings', () => {
  it('未指定キーはデフォルト値で埋める', () => {
    const isp = parseIspSettings('bri 200\nexpmode manual');
    expect(isp.bri).toBe(200);
    expect(isp.cont).toBe(128); // デフォルト
    expect(isp.expmode).toBe('manual');
  });

  it('不正な expmode は auto のまま', () => {
    expect(parseIspSettings('expmode weird').expmode).toBe('auto');
  });
});

describe('parseProperty', () => {
  it('key=value 行を取り込み valid を立てる', () => {
    const prop = parseProperty('ok\nrecordType=1\nvideoQuality=2');
    expect(prop.valid).toBe(true);
    expect(prop.recordType).toBe('1');
  });

  it('データ行がなければ valid=false', () => {
    expect(parseProperty('ok\n').valid).toBe(false);
  });
});

describe('watermark バイナリ', () => {
  it('parseWatermarkDimensions はリトルエンディアン u16 を読む', () => {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setUint16(0, 32, true); // height
    dv.setUint16(4, 64, true); // width
    expect(parseWatermarkDimensions(buf)).toEqual({ width: 64, height: 32 });
  });

  it('短いバッファ・ゼロ寸法は null', () => {
    expect(parseWatermarkDimensions(new ArrayBuffer(4))).toBeNull();
    expect(parseWatermarkDimensions(new ArrayBuffer(8))).toBeNull();
  });

  it('rgbaToBgra はヘッダ 8 バイト + BGRA 変換', () => {
    const rgba = new Uint8ClampedArray([1, 2, 3, 4]); // R,G,B,A
    const out = rgbaToBgra(rgba, 1, 1);
    expect(out.length).toBe(12);
    const dv = new DataView(out.buffer);
    expect(dv.getUint16(0, true)).toBe(1); // height
    expect(dv.getUint16(4, true)).toBe(1); // width
    expect([...out.slice(8)]).toEqual([3, 2, 1, 4]); // B,G,R,A
  });
});
