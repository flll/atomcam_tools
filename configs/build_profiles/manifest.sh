# shellcheck shell=bash
# Profile definitions for atomcam_tools (sourced by scripts/make/build-profile.sh)

BUILD_PROFILE_ALL="simple tailscale hil cyclo harness agent full"

profile_desc() {
  case "$1" in
    simple)    echo "最小ビルド（Tailscale 無効・デバッグ資産なし）" ;;
    tailscale) echo "標準ビルド（Tailscale 有効・既定）" ;;
    hil)       echo "HIL 開発（SD ブートストラップ向け資産を target にステージ）" ;;
    cyclo)     echo "HIL サイクル（hil と同じ・反復 deploy-test 向け）" ;;
    harness)   echo "デバッグ反復ループ（mmc .fixed テンプレ + HIL 資産）" ;;
    agent)     echo "Cursor エージェント向け（harness + デバッグ SSH 鍵）" ;;
    full)      echo "フル（tailscale + harness + agent 鍵 + sd-package 自動）" ;;
    *)         echo "unknown" ;;
  esac
}

profile_apply_vars() {
  PROFILE="$1"
  case "$PROFILE" in
    simple)
      PROFILE_FRAGMENT="/src/configs/build_profiles/simple.fragment"
      INCLUDE_TAILSCALE=n
      INCLUDE_HIL_ASSETS=n
      INCLUDE_HARNESS_MMC=n
      INCLUDE_AGENT_KEYS=n
      SD_PACKAGE_AFTER_BUILD=n
      ;;
    tailscale)
      PROFILE_FRAGMENT="/src/configs/build_profiles/tailscale.fragment"
      INCLUDE_TAILSCALE=y
      INCLUDE_HIL_ASSETS=n
      INCLUDE_HARNESS_MMC=n
      INCLUDE_AGENT_KEYS=n
      SD_PACKAGE_AFTER_BUILD=n
      ;;
    hil|cyclo)
      PROFILE_FRAGMENT="/src/configs/build_profiles/tailscale.fragment"
      INCLUDE_TAILSCALE=y
      INCLUDE_HIL_ASSETS=y
      INCLUDE_HARNESS_MMC=n
      INCLUDE_AGENT_KEYS=n
      SD_PACKAGE_AFTER_BUILD=n
      ;;
    harness)
      PROFILE_FRAGMENT="/src/configs/build_profiles/tailscale.fragment"
      INCLUDE_TAILSCALE=y
      INCLUDE_HIL_ASSETS=y
      INCLUDE_HARNESS_MMC=y
      INCLUDE_AGENT_KEYS=n
      SD_PACKAGE_AFTER_BUILD=y
      ;;
    agent)
      PROFILE_FRAGMENT="/src/configs/build_profiles/tailscale.fragment"
      INCLUDE_TAILSCALE=y
      INCLUDE_HIL_ASSETS=y
      INCLUDE_HARNESS_MMC=y
      INCLUDE_AGENT_KEYS=y
      SD_PACKAGE_AFTER_BUILD=y
      ;;
    full)
      PROFILE_FRAGMENT="/src/configs/build_profiles/tailscale.fragment"
      INCLUDE_TAILSCALE=y
      INCLUDE_HIL_ASSETS=y
      INCLUDE_HARNESS_MMC=y
      INCLUDE_AGENT_KEYS=y
      SD_PACKAGE_AFTER_BUILD=y
      ;;
    *)
      return 1
      ;;
  esac
  return 0
}
