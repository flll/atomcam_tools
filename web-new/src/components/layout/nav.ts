import {
  Bell,
  Camera,
  Compass,
  Disc3,
  Folder,
  HardDrive,
  Radio,
  Server,
  Video,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavGroup = 'live' | 'settings' | 'tools';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  // i18n キー（ui.json の nav.*）
  labelKey: string;
  // サイドバーのグループ見出し
  group: NavGroup;
  // モバイルのボトムバーに出す主要項目か(残りは「その他」シートから開く)
  primary?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', icon: Video, labelKey: 'nav.live', group: 'live', primary: true },
  { to: '/settings/camera', icon: Camera, labelKey: 'nav.camera', group: 'settings' },
  { to: '/settings/recording', icon: Disc3, labelKey: 'nav.recording', group: 'settings', primary: true },
  { to: '/settings/storage', icon: HardDrive, labelKey: 'nav.storage', group: 'settings' },
  { to: '/settings/streaming', icon: Radio, labelKey: 'nav.streaming', group: 'settings', primary: true },
  { to: '/settings/events', icon: Bell, labelKey: 'nav.events', group: 'settings' },
  { to: '/settings/cruise', icon: Compass, labelKey: 'nav.cruise', group: 'settings' },
  { to: '/settings/system', icon: Server, labelKey: 'nav.system', group: 'settings' },
  { to: '/files', icon: Folder, labelKey: 'nav.files', group: 'tools' },
  { to: '/maintenance', icon: Wrench, labelKey: 'nav.maintenance', group: 'tools' },
];
