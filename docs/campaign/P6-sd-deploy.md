# P6 作業記録 — SD への 7.1 配置と起動チェーン

## 判明した起動チェーン(実物解析による確定)

```
純正 u-boot (NOR・無改変)
  → SD 第1パーティション(FAT32)の factory_t31_ZMC6tiIDQN を
    「カーネル uImage として」直接ロードして起動
  → uImage 内蔵の initramfs /init が SD をマウントし
    rootfs_*.squashfs を loop mount → switch_root
```

`factory_t31_ZMC6tiIDQN` は設定ファイルでもブートローダでもなく **uImage そのもの**。
つまりカーネル差し替え = このファイルの差し替え1つで済む。NOR には一切触れない。

## 7.1 initramfs の作り方(再現手順)

1. 現行 3.10 uImage から initramfs を抽出できる:
   - uImage 64B ヘッダを剥がし LZMA 解凍 → vmlinux
   - vmlinux 内の LZMA ストリーム(5D 00 00)を総当たりで解凍し、
     先頭が `070701`(cpio newc)になるものが initramfs
   - **busybox は static** なのでカーネルが変わってもそのまま動く
2. initramfs_71/init(本ディレクトリ)が 7.1 用 init。要点:
   - **UART が無い機体のため、全ステップを SD の boot71.log に書いて sync する**
     (起動失敗時は SD を PC で読めばどこで死んだか分かる)
   - `initramfs-debug` ファイルが SD にあればシェルへ(デバッグフック)
   - rootfs_71.squashfs を loop mount → switch_root /newroot /init(thingino)
3. thingino 側: user/<cam>/local.fragment(本ディレクトリに写し)で
   - BR2_THINGINO_DEV_PACKAGES / DEV_EXPERIMENTAL / KERNEL_VERSION_7 を開栓
   - BR2_LINUX_KERNEL_CONFIG_FRAGMENT_FILES で kernel-initramfs.fragment を注入
     (CONFIG_INITRAMFS_SOURCE="<initramfs_root> <devnodes.txt>")
4. `make BOARD=atom_cam2_t31x_gc2053_atbm6031 KERNEL_VERSION=7.1-rc1`
   - **罠**: uImage が既に存在するとラッパが2秒で素通りする。
     images/uImage と linux の .stamp_* を消してから叩く
   - **罠**: install が uutils だと弾かれる。PATH=$HOME/bin-gnu:$PATH を付ける

## SD 配置(2026-07-31 実施)

| ファイル | md5 |
|---|---|
| factory_t31_ZMC6tiIDQN(7.1 uImage+initramfs, 4,341,935B) | 635f714847c961e52975fcd5be6cc023 |
| factory_t31_ZMC6tiIDQN.310(旧3.10退避) | 5ca130feb23e2331b31a9ccb379d1c70 |
| rootfs_71.squashfs(thingino 7.1, xz) | 1da4e6d61885d39789a6aed0e8b803f9 |

rootfs_hack.squashfs / hack.ini 等の 3.10 環境は全て無傷で温存。

## 復旧手順(いつでも可能)

1. SD を PC に挿す
2. `factory_t31_ZMC6tiIDQN` を削除し、`factory_t31_ZMC6tiIDQN.310` を
   `factory_t31_ZMC6tiIDQN` にリネーム
3. カメラに戻す → 3.10 環境に完全復帰

SD 全損時: hx90 `C:\Users\no5\atomcam-71\sd-backup-20260731\`(ブート・設定系 128MB、
md5 照合済み)から復元。NOR は無改変なので SD を抜けば純正起動。

## 判定方法(KS-2)

電源投入 → 3分 → SD を PC で読む:
- boot71.log に `uname -a`(7.1.0-rc1) → **カーネル起動成功**
- `squashfs mounted ok` + `switch_root -> /init` → **ユーザーランド到達 = KS-2 合格**
- ログ自体が無い → カーネルが SD ドライバ到達前に死亡(config/DT を疑う)
- WiFi 設定は未投入のため、**成功していてもネットワークには現れない**(正常)
