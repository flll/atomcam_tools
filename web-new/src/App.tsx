import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

// 初回ロードは Live のみ同梱。設定ページ群は遅延ロード（ページ単位 code splitting）。
const Live = lazy(() => import('@/pages/Live'));
const Placeholder = lazy(() => import('@/pages/Placeholder'));

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Live />} />
        <Route path="settings/camera" element={<Placeholder titleKey="nav.camera" />} />
        <Route path="settings/recording" element={<Placeholder titleKey="nav.recording" />} />
        <Route path="settings/storage" element={<Placeholder titleKey="nav.storage" />} />
        <Route path="settings/streaming" element={<Placeholder titleKey="nav.streaming" />} />
        <Route path="settings/events" element={<Placeholder titleKey="nav.events" />} />
        <Route path="settings/cruise" element={<Placeholder titleKey="nav.cruise" />} />
        <Route path="settings/system" element={<Placeholder titleKey="nav.system" />} />
        <Route path="files" element={<Placeholder titleKey="nav.files" />} />
        <Route path="maintenance" element={<Placeholder titleKey="nav.maintenance" />} />
        <Route path="*" element={<Placeholder titleKey="nav.live" />} />
      </Route>
    </Routes>
  );
}
