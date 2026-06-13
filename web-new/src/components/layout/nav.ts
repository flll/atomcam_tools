import {
  Bell,
  Camera,
  Compass,
  Folder,
  HardDrive,
  Radio,
  Server,
  Video,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  // i18n キー（ui.json の nav.*）
  labelKey: string;
  // モバイルのボトムバーに出す主要項目か
  primary?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', icon: Video, labelKey: 'nav.live', primary: true },
  { to: '/settings/camera', icon: Camera, labelKey: 'nav.camera', primary: true },
  { to: '/settings/recording', icon: Radio, labelKey: 'nav.recording' },
  { to: '/settings/storage', icon: HardDrive, labelKey: 'nav.storage' },
  { to: '/settings/streaming', icon: Radio, labelKey: 'nav.streaming', primary: true },
  { to: '/settings/events', icon: Bell, labelKey: 'nav.events' },
  { to: '/settings/cruise', icon: Compass, labelKey: 'nav.cruise' },
  { to: '/settings/system', icon: Server, labelKey: 'nav.system' },
  { to: '/files', icon: Folder, labelKey: 'nav.files' },
  { to: '/maintenance', icon: Wrench, labelKey: 'nav.maintenance', primary: true },
];
