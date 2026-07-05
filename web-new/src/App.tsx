import { lazy } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { loadMotionFeatures } from '@/lib/motion-features';

const Live = lazy(() => import('@/pages/Live'));
const Camera = lazy(() => import('@/pages/Camera'));
const Recording = lazy(() => import('@/pages/Recording'));
const Storage = lazy(() => import('@/pages/Storage'));
const Streaming = lazy(() => import('@/pages/Streaming'));
const Events = lazy(() => import('@/pages/Events'));
const Cruise = lazy(() => import('@/pages/Cruise'));
const System = lazy(() => import('@/pages/System'));
const Files = lazy(() => import('@/pages/Files'));
const Maintenance = lazy(() => import('@/pages/Maintenance'));
const Placeholder = lazy(() => import('@/pages/Placeholder'));

export default function App() {
  return (
    // strict: m.* のみ許可(motion.* の誤用でフルバンドルが混入するのを防ぐ)
    // reducedMotion: OS の「視差効果を減らす」設定でアニメーションを自動抑制
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Live />} />
            <Route path="settings/camera" element={<Camera />} />
            <Route path="settings/recording" element={<Recording section="periodic" />} />
            <Route path="settings/recording/alarm" element={<Recording section="alarm" />} />
            <Route path="settings/recording/timelapse" element={<Recording section="timelapse" />} />
            <Route path="settings/storage" element={<Storage />} />
            <Route path="settings/streaming" element={<Streaming section="rtsp" />} />
            <Route path="settings/streaming/rtmp" element={<Streaming section="rtmp" />} />
            <Route path="settings/streaming/webrtc" element={<Streaming section="webrtc" />} />
            <Route path="settings/events" element={<Events />} />
            <Route path="settings/cruise" element={<Cruise />} />
            <Route path="settings/system" element={<System section="device" />} />
            <Route path="settings/system/tailscale" element={<System section="tailscale" />} />
            <Route path="files" element={<Files />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="*" element={<Placeholder titleKey="nav.live" />} />
          </Route>
        </Routes>
      </MotionConfig>
    </LazyMotion>
  );
}
