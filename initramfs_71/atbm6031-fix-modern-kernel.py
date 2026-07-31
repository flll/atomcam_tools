#!/usr/bin/env python3
"""kernel 7.x (modern kbuild / API) 向けの atbm-wifi ソース修正。

3.10/4.4 では LINUX_VERSION_CODE のガードにより無効化されるため、
どのカーネル向けビルドでも同じソースに適用してよい(冪等)。
CRLF 混在ソースのためバイト単位で置換する。
"""
import sys, os

d = sys.argv[1]

def patch(path, subs):
    p = os.path.join(d, path)
    b = open(p, "rb").read()
    changed = False
    for old, new in subs:
        if new in b:          # 冪等: 適用済みならスキップ
            continue
        if old not in b:
            print(f"WARN: pattern not found in {path}: {old[:60]!r}")
            continue
        b = b.replace(old, new)
        changed = True
    if changed:
        open(p, "wb").write(b)
        print(f"patched {path}")

# 1) wdev->mtx は 5.12 で wiphy ロックに置き換えられた
patch("include/net/atbm_mac80211.h", [
    (b"\tmutex_lock(&wdev->mtx);",
     b"#if LINUX_VERSION_CODE >= KERNEL_VERSION(5,12,0)\n"
     b"\tmutex_lock(&wdev->wiphy->mtx);\n"
     b"#else\n"
     b"\tmutex_lock(&wdev->mtx);\n"
     b"#endif"),
    (b"\tmutex_unlock(&wdev->mtx);",
     b"#if LINUX_VERSION_CODE >= KERNEL_VERSION(5,12,0)\n"
     b"\tmutex_unlock(&wdev->wiphy->mtx);\n"
     b"#else\n"
     b"\tmutex_unlock(&wdev->mtx);\n"
     b"#endif"),
])

# 2) compat-2.6.h に新カーネル向け互換定義を追記
#    (全 TU に -include されるので、ここに置けばソース改変が最小で済む)
compat = os.path.join(d, "include/linux/compat-2.6.h")
b = open(compat, "rb").read()
marker = b"ATBM_MODERN_KERNEL_COMPAT"
if marker not in b:
    b += b"""
/* ATBM_MODERN_KERNEL_COMPAT: kernel 7.x support (auto-appended by thingino build) */
#include <linux/version.h>
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,15,0)
/* del_timer/del_timer_sync were removed in 6.15 */
#define del_timer timer_delete
#define del_timer_sync timer_delete_sync
#endif
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,16,0)
/* from_timer was renamed to timer_container_of in 6.16 */
#define from_timer(var, callback_timer, timer_fieldname) \\
\ttimer_container_of(var, callback_timer, timer_fieldname)
#endif
#if LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0)
/* cfg80211_new_sta/cfg80211_del_sta take a wireless_dev in 7.x.
 * Use alias macros (NOT same-name macros: those would mangle the
 * declarations in cfg80211.h itself, since this header is -include'd
 * before everything). Call sites are rewritten to the alias below. */
#define atbm_compat_cfg80211_new_sta(dev, addr, sinfo, gfp) \\
\tcfg80211_new_sta((dev)->ieee80211_ptr, addr, sinfo, gfp)
#define atbm_compat_cfg80211_del_sta(dev, addr, gfp) \\
\tcfg80211_del_sta((dev)->ieee80211_ptr, addr, gfp)
#else
#define atbm_compat_cfg80211_new_sta cfg80211_new_sta
#define atbm_compat_cfg80211_del_sta cfg80211_del_sta
#endif
"""
    open(compat, "wb").write(b)
    print("compat-2.6.h extended")

# 3) 呼び出し箇所を別名マクロへ (patch() は適用済みならスキップするので冪等)
patch("hal_apollo/mac80211/sta_info.c", [
    (b"cfg80211_new_sta(sdata->dev,", b"atbm_compat_cfg80211_new_sta(sdata->dev,"),
    (b"cfg80211_del_sta(sdata->dev,", b"atbm_compat_cfg80211_del_sta(sdata->dev,"),
])

# 4) station_parameters: supported_rates/ht_capa は 5.19 で link_sta_params へ移動。
#    ATBM_SP マクロ(compat-2.6.h で定義)経由に置換
b = open(compat, "rb").read()
if b"ATBM_SP(" not in b:
    b += (b"#if LINUX_VERSION_CODE >= KERNEL_VERSION(5,19,0)\n"
          b"#define ATBM_SP(p) (&(p)->link_sta_params)\n"
          b"#else\n"
          b"#define ATBM_SP(p) (p)\n"
          b"#endif\n")
    open(compat, "wb").write(b)
    print("ATBM_SP macro added")
patch("hal_apollo/mac80211/cfg.c", [
    (b"params->supported_rates", b"ATBM_SP(params)->supported_rates"),
    (b"params->ht_capa", b"ATBM_SP(params)->ht_capa"),
])

# 5) cfg80211_ops の 7.x シグネチャ適合ラッパを ops テーブル直前に挿入。
#    ラッパ定義の後に #define で関数名を差し替え、テーブル側は無改変で済ませる
OPS_ANCHOR = b"struct cfg80211_ops mac80211_config_ops = {"
WRAPPERS = b"""#if LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0)
/* ---- kernel 7.x cfg80211_ops adapters (auto-inserted by thingino build) ---- */
static int atbm71_add_key(struct wiphy *wiphy, struct wireless_dev *wdev,
\tint link_id, u8 key_index, bool pairwise, const u8 *mac_addr,
\tstruct key_params *params)
{ return ieee80211_add_key(wiphy, wdev->netdev, key_index, pairwise, mac_addr, params); }
static int atbm71_del_key(struct wiphy *wiphy, struct wireless_dev *wdev,
\tint link_id, u8 key_index, bool pairwise, const u8 *mac_addr)
{ return ieee80211_del_key(wiphy, wdev->netdev, key_index, pairwise, mac_addr); }
static int atbm71_get_key(struct wiphy *wiphy, struct wireless_dev *wdev,
\tint link_id, u8 key_index, bool pairwise, const u8 *mac_addr,
\tvoid *cookie, void (*callback)(void *cookie, struct key_params *params))
{ return ieee80211_get_key(wiphy, wdev->netdev, key_index, pairwise, mac_addr, cookie, callback); }
static int atbm71_set_default_key(struct wiphy *wiphy, struct net_device *dev,
\tint link_id, u8 key_index, bool unicast, bool multicast)
{ return ieee80211_config_default_key(wiphy, dev, key_index, unicast, multicast); }
static int atbm71_set_default_mgmt_key(struct wiphy *wiphy, struct wireless_dev *wdev,
\tint link_id, u8 key_index)
{ return ieee80211_config_default_mgmt_key(wiphy, wdev->netdev, key_index); }
static int atbm71_add_station(struct wiphy *wiphy, struct wireless_dev *wdev,
\tconst u8 *mac, struct station_parameters *params)
{ return ieee80211_add_station(wiphy, wdev->netdev, mac, params); }
static int atbm71_del_station(struct wiphy *wiphy, struct wireless_dev *wdev,
\tstruct station_del_parameters *params)
{ return ieee80211_del_station(wiphy, wdev->netdev, params); }
static int atbm71_change_station(struct wiphy *wiphy, struct wireless_dev *wdev,
\tconst u8 *mac, struct station_parameters *params)
{ return ieee80211_change_station(wiphy, wdev->netdev, mac, params); }
static int atbm71_get_station(struct wiphy *wiphy, struct wireless_dev *wdev,
\tconst u8 *mac, struct station_info *sinfo)
{ return ieee80211_get_station(wiphy, wdev->netdev, mac, sinfo); }
static int atbm71_dump_station(struct wiphy *wiphy, struct wireless_dev *wdev,
\tint idx, u8 *mac, struct station_info *sinfo)
{ return ieee80211_dump_station(wiphy, wdev->netdev, idx, mac, sinfo); }
static int atbm71_change_beacon(struct wiphy *wiphy, struct net_device *dev,
\tstruct cfg80211_ap_update *info)
{ return ieee80211_change_beacon(wiphy, dev, &info->beacon); }
static int atbm71_set_monitor_channel(struct wiphy *wiphy, struct net_device *dev,
\tstruct cfg80211_chan_def *chandef)
{ return ieee80211_set_monitor_channel(wiphy, chandef); }
static int atbm71_set_wiphy_params(struct wiphy *wiphy, int radio_idx, u32 changed)
{ return ieee80211_set_wiphy_params(wiphy, changed); }
#define ieee80211_add_key atbm71_add_key
#define ieee80211_del_key atbm71_del_key
#define ieee80211_get_key atbm71_get_key
#define ieee80211_config_default_key atbm71_set_default_key
#define ieee80211_config_default_mgmt_key atbm71_set_default_mgmt_key
#define ieee80211_add_station atbm71_add_station
#define ieee80211_del_station atbm71_del_station
#define ieee80211_change_station atbm71_change_station
#define ieee80211_get_station atbm71_get_station
#define ieee80211_dump_station atbm71_dump_station
#define ieee80211_change_beacon atbm71_change_beacon
#define ieee80211_set_monitor_channel atbm71_set_monitor_channel
#define ieee80211_set_wiphy_params atbm71_set_wiphy_params
#endif /* >= 7.0 */
"""
patch("hal_apollo/mac80211/cfg.c", [(OPS_ANCHOR, WRAPPERS + OPS_ANCHOR)])

# 6) mlme.c: rx_assoc_resp / assoc_timeout / disassoc_request.bss の 7.x 対応
patch("hal_apollo/mac80211/mlme.c", [
    (b"\tcfg80211_rx_assoc_resp(wk->sdata->dev,wk->assoc.bss,(u8*)mgmt,len, -1, NULL, 0);",
     b"#if (LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0))\n"
     b"\t{\n"
     b"\t\tstruct cfg80211_rx_assoc_resp_data atbm_resp = {};\n"
     b"\t\tatbm_resp.buf = (u8*)mgmt;\n"
     b"\t\tatbm_resp.len = len;\n"
     b"\t\tatbm_resp.uapsd_queues = -1;\n"
     b"\t\tatbm_resp.links[0].bss = wk->assoc.bss;\n"
     b"\t\tcfg80211_rx_assoc_resp(wk->sdata->dev, &atbm_resp);\n"
     b"\t}\n"
     b"#else\n"
     b"\tcfg80211_rx_assoc_resp(wk->sdata->dev,wk->assoc.bss,(u8*)mgmt,len, -1, NULL, 0);\n"
     b"#endif"),
    (b"\tcfg80211_assoc_timeout(wk->sdata->dev,wk->assoc.bss/*wk->filter_bssid*/);",
     b"#if (LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0))\n"
     b"\t{\n"
     b"\t\tstruct cfg80211_assoc_failure atbm_fail = {};\n"
     b"\t\tatbm_fail.bss[0] = wk->assoc.bss;\n"
     b"\t\tatbm_fail.timeout = true;\n"
     b"\t\tcfg80211_assoc_failure(wk->sdata->dev, &atbm_fail);\n"
     b"\t}\n"
     b"#else\n"
     b"\tcfg80211_assoc_timeout(wk->sdata->dev,wk->assoc.bss/*wk->filter_bssid*/);\n"
     b"#endif"),
    (b"\tif (ifmgd->associated != req->bss) {",
     b"#if (LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0))\n"
     b"\tif (!ifmgd->associated || memcmp(ifmgd->associated->bssid, req->ap_addr, ETH_ALEN) != 0) {\n"
     b"#else\n"
     b"\tif (ifmgd->associated != req->bss) {\n"
     b"#endif"),
    (b"\t       sdata->name, req->bss->bssid, req->reason_code);",
     b"#if (LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0))\n"
     b"\t       sdata->name, req->ap_addr, req->reason_code);\n"
     b"#else\n"
     b"\t       sdata->name, req->bss->bssid, req->reason_code);\n"
     b"#endif"),
    (b"\tmemcpy(bssid, req->bss->bssid, ETH_ALEN);",
     b"#if (LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0))\n"
     b"\tmemcpy(bssid, req->ap_addr, ETH_ALEN);\n"
     b"#else\n"
     b"\tmemcpy(bssid, req->bss->bssid, ETH_ALEN);\n"
     b"#endif"),
    (b"\tieee80211_send_deauth_disassoc(sdata, req->bss->bssid,",
     b"#if (LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0))\n"
     b"\tieee80211_send_deauth_disassoc(sdata, req->ap_addr,\n"
     b"#else\n"
     b"\tieee80211_send_deauth_disassoc(sdata, req->bss->bssid,\n"
     b"#endif"),
])

# 7) 残りの細かい API 差分 (rx.c / 共有ヘッダ / MIN_ACTION_SIZE)
b = open(compat, "rb").read()
if b"ATBM_RX_SPURIOUS_LINKID" not in b:
    b += (b"/* cfg80211_rx_spurious_frame gained link_id (7.x);\n"
          b" * ieee80211_amsdu_to_8023s gained mesh_control (6.3) */\n"
          b"#if LINUX_VERSION_CODE >= KERNEL_VERSION(7,0,0)\n"
          b"#define ATBM_RX_SPURIOUS_LINKID -1,\n"
          b"#else\n"
          b"#define ATBM_RX_SPURIOUS_LINKID\n"
          b"#endif\n"
          b"#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,3,0)\n"
          b"#define ATBM_AMSDU_MESHCTL ,0\n"
          b"#else\n"
          b"#define ATBM_AMSDU_MESHCTL\n"
          b"#endif\n"
          b"/* IEEE80211_MIN_ACTION_SIZE became a function-like macro upstream;\n"
          b" * the driver expects the old constant (24 + 1) */\n"
          b"#define ATBM_MIN_ACTION_SIZE (24 + 1)\n")
    open(compat, "wb").write(b)
    print("misc compat macros added")

patch("hal_apollo/mac80211/rx.c", [
    (b"cfg80211_rx_spurious_frame(rx->sdata->dev,hdr->addr2,GFP_ATOMIC)",
     b"cfg80211_rx_spurious_frame(rx->sdata->dev,hdr->addr2,ATBM_RX_SPURIOUS_LINKID GFP_ATOMIC)"),
])
patch("hal_apollo/mac80211/ieee80211_atbm_skb.h", [
    (b"ieee80211_amsdu_to_8023s(_skb, _list,_addr,_iftype,_extra_headroom,NULL,NULL);",
     b"ieee80211_amsdu_to_8023s(_skb, _list,_addr,_iftype,_extra_headroom,NULL,NULL ATBM_AMSDU_MESHCTL);"),
])
patch("hal_apollo/mac80211/bridge.c", [
    (b"#include <net/ipx.h>",
     b"#if LINUX_VERSION_CODE < KERNEL_VERSION(5,15,0)\n"
     b"#include <net/ipx.h>  /* IPX was removed from the kernel; header unused anyway */\n"
     b"#endif"),
])
# 8) ドライバ本体 (hal_apollo/) の 6.x/7.x 差分
b = open(compat, "rb").read()
if b"prandom_u32" not in b:
    b += (b"#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,1,0)\n"
          b"/* prandom_u32 was removed in 6.1 */\n"
          b"#define prandom_u32 get_random_u32\n"
          b"#endif\n")
    open(compat, "wb").write(b)
    print("prandom compat added")

# skb_frag_t: bv_page/bv_offset/bv_len (5.4 naming) -> accessor helpers (all-kernel safe)
patch("hal_apollo/util.c", [
    (b"memcpy(xmit,page_address(frag->bv_page) + frag->bv_offset,frag->bv_len);",
     b"memcpy(xmit,page_address(skb_frag_page(frag)) + skb_frag_off(frag),skb_frag_size(frag));"),
    (b"xmit += frag->bv_len;", b"xmit += skb_frag_size(frag);"),
    (b"sg_len += frag->bv_len;", b"sg_len += skb_frag_size(frag);"),
])

# MODULE_IMPORT_NS takes a string literal since 6.13
patch("hal_apollo/main.c", [
    (b"MODULE_IMPORT_NS(VFS_internal_I_am_really_a_filesystem_and_am_NOT_a_driver); ",
     b"#if LINUX_VERSION_CODE >= KERNEL_VERSION(6,13,0)\n"
     b"MODULE_IMPORT_NS(\"VFS_internal_I_am_really_a_filesystem_and_am_NOT_a_driver\");\n"
     b"#else\n"
     b"MODULE_IMPORT_NS(VFS_internal_I_am_really_a_filesystem_and_am_NOT_a_driver);\n"
     b"#endif"),
])

# 9) gcc15 の厳格化 (-Werror=return-type / incompatible-pointer-types) で落ちる既存の雑コード
patch("hal_apollo/dev_ioctl.c", [
    (b"ieee80211_send_probe_resp_mgmt_queue(hw_priv,&ap_vendor_cfg_ie,1);",
     b"ieee80211_send_probe_resp_mgmt_queue(hw_priv,(char *)&ap_vendor_cfg_ie,1);"),
    (b"ieee80211_send_action_mgmt_queue(hw_priv,&customer_action_ie,1);",
     b"ieee80211_send_action_mgmt_queue(hw_priv,(char *)&customer_action_ie,1);"),
])
# atbm_dev_set_private_mgmt_frame は int を返す宣言なのに末尾 return が無い。
# 関数末尾 (次の関数定義の直前の閉じブレース) に return 0 を挿す
p = os.path.join(d, "hal_apollo/dev_ioctl.c")
b = open(p, "rb").read()
if b"return 0; /* atbm-71-fix */" not in b:
    idx = b.find(b"static int atbm_dev_set_private_mgmt_frame")
    idx2 = b.find(b"static int atbm_dev_set_private_mgmt_frame", idx + 1)
    if idx2 >= 0:
        idx = idx2                                # 1つ目は前方宣言のことがある
    if idx >= 0:
        nxt = b.find(b"\nstatic ", idx + 10)          # 次のトップレベル定義
        close = b.rfind(b"}", idx, nxt)               # その手前の最後の '}'
        if close > 0:
            b = b[:close] + b"\treturn 0; /* atbm-71-fix */\n" + b[close:]
            open(p, "wb").write(b)
            print("return added to atbm_dev_set_private_mgmt_frame")

for f in ["hal_apollo/atbm_p2p.c", "hal_apollo/mac80211/mesh_hwmp.c",
          "hal_apollo/mac80211/mesh_plink.c", "hal_apollo/mac80211/offchannel.c",
          "hal_apollo/mac80211/rx.c", "hal_apollo/mac80211/util.c"]:
    patch(f, [(b"IEEE80211_MIN_ACTION_SIZE", b"ATBM_MIN_ACTION_SIZE")])
print("done")
