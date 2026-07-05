import type { ReactNode } from 'react';
import {
  Crosshair,
  Expand,
  Gamepad2,
  Minimize2,
  Moon,
  PictureInPicture2,
  RectangleHorizontal,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { springGentle } from '@/lib/motion-tokens';
import { SegmentedControl } from '@/components/ui/segmented';

export type NightVision = 'on' | 'auto' | 'off';

function IconBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex size-9 items-center justify-center rounded-full text-white backdrop-blur transition-all duration-short-2 ease-standard active:scale-90',
        active ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20',
      )}
    >
      {children}
    </button>
  );
}

// 下部グラデーションスクリム+自動非表示のコントロールバー(YouTube 方式)。
export function PlayerControls({
  visible,
  isWebrtc,
  muted,
  onToggleMute,
  nightVision,
  onNightChange,
  isAtom,
  isSwing,
  onFlip,
  onCenter,
  ptzOpen,
  onTogglePtz,
  theaterActive,
  onToggleTheater,
  pipSupported,
  onTogglePip,
  fullscreenActive,
  onToggleFullscreen,
}: {
  visible: boolean;
  isWebrtc: boolean;
  muted: boolean;
  onToggleMute: () => void;
  nightVision: NightVision;
  onNightChange: (v: NightVision) => void;
  isAtom: boolean;
  isSwing: boolean;
  onFlip: () => void;
  onCenter: () => void;
  ptzOpen?: boolean;
  onTogglePtz?: () => void;
  theaterActive?: boolean;
  onToggleTheater?: () => void;
  pipSupported?: boolean;
  onTogglePip?: () => void;
  fullscreenActive: boolean;
  onToggleFullscreen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          data-testid="player-controls"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={springGentle}
          className="absolute inset-x-0 bottom-0 z-10"
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="relative flex flex-wrap items-center justify-between gap-2 px-3 pb-3 pt-8">
            <div className="flex flex-wrap items-center gap-2">
              {isWebrtc && (
                <IconBtn label={muted ? t('live.audioOn') : t('live.audioOff')} onClick={onToggleMute}>
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </IconBtn>
              )}
              <SegmentedControl<NightVision>
                label={t('live.nightVision')}
                value={nightVision}
                onChange={onNightChange}
                options={[
                  { value: 'on', label: <Moon className="size-3.5" />, title: 'on' },
                  { value: 'auto', label: 'AUTO', title: 'auto' },
                  { value: 'off', label: 'OFF', title: 'off' },
                ]}
              />
              {isAtom && (
                <IconBtn label={t('live.flip')} onClick={onFlip}>
                  <RefreshCw className="size-4" />
                </IconBtn>
              )}
              {isSwing && (
                <IconBtn label={t('live.center')} onClick={onCenter}>
                  <Crosshair className="size-4" />
                </IconBtn>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isSwing && onTogglePtz && (
                <IconBtn label={t('live.openPtz')} onClick={onTogglePtz} active={ptzOpen}>
                  <Gamepad2 className="size-4" />
                </IconBtn>
              )}
              {onToggleTheater && (
                <span className="hidden md:block">
                  <IconBtn
                    label={theaterActive ? t('live.exitTheater') : t('live.theater')}
                    onClick={onToggleTheater}
                    active={theaterActive}
                  >
                    <RectangleHorizontal className="size-4" />
                  </IconBtn>
                </span>
              )}
              {pipSupported && onTogglePip && (
                <IconBtn label={t('live.pip')} onClick={onTogglePip}>
                  <PictureInPicture2 className="size-4" />
                </IconBtn>
              )}
              <IconBtn
                label={fullscreenActive ? t('live.exitFullscreen') : t('live.fullscreen')}
                onClick={onToggleFullscreen}
                active={fullscreenActive}
              >
                {fullscreenActive ? <Minimize2 className="size-4" /> : <Expand className="size-4" />}
              </IconBtn>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
