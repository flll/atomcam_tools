# initramfs スケルトン

カーネルイメージに埋め込まれる initramfs のひな形です。ここに置いたファイルはカーネル本体に取り込まれるため、サイズに注意してください（カーネルは約 2MB に収める必要があります）。

git では空ディレクトリや dev ノードをコミットできないため、`buildscripts/make_initramfs.sh` が実行時にそれらを動的に作成し、このスケルトンと静的 busybox / fsck 類をまとめて cpio 化します。生成された cpio はカーネルの `CONFIG_INITRAMFS_SOURCE`（`<buildroot>/output/images/initramfs.cpio`）として埋め込まれます。

このスクリプトは `buildscripts/linux_prebuild_hook.sh` 経由で Buildroot の `LINUX_PRE_BUILD_HOOKS`（`patches/linux_makefile.patch` で配線）から自動的に呼ばれます。

## 再ビルド

スケルトンを変更した後は、ホスト側で次を実行するとカーネルごと再生成されます。

```bash
make linux-rebuild
make build
```
