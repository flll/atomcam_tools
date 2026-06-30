# WebUI HIL チェックリスト — 2026-06-30

- ホスト: 10.0.0.228
- デプロイ: rootfs repack (`/tmp/rootfs_hack_webui.squashfs`) → squashfs-only
- 自動確認: `index.html` に Vite `/assets/`、`/assets/index-*.js` HTTP 200 ✅
- smoke: SSH refused（sshd 未起動の可能性 — repack 時 fakeroot 未使用が原因候補）
- 手動巡回: ブラウザで http://10.0.0.228/ 新 UI 表示確認

## ページ巡回（ja / en）

| ルート | ja | en |
|--------|----|----|
| / Live | [ ] | [ ] |
| /settings/camera | [ ] | [ ] |
| /settings/storage | [ ] | [ ] |
| /settings/recording | [ ] | [ ] |
| /settings/streaming | [ ] | [ ] |
| /settings/events | [ ] | [ ] |
| /settings/cruise | [ ] | [ ] |
| /settings/system | [ ] | [ ] |
| /files | [ ] | [ ] |
| /maintenance | [ ] | [ ] |

## フォローアップ

- [ ] `fakeroot mksquashfs` で再パック → redeploy → SSH/smoke 全 pass
- [ ] 本番は `make build WEB_UI=web-new` フルビルド推奨
