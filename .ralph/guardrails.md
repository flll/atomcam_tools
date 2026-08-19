# guardrails — 毎イテレーションの最初に全文読む

- 7.1（initramfs_71 / campaign-state / AGENTS-71）は触らない。stash を pop しない
- SPI / NOR / 実機 deploy / 公式 demo.bin 再install はしない
- docker build の tee 終了コードを成功と見るな。ログ末尾の ERROR: failed が正本
- 走っている docker build を kill しない。二重起動しない
- 1周で直す fatal は1件。次のヘッダ不足は次周
- S9 typescript 7 / S12 go2rtc 1.9.14 は即 RALPH_BLOCKED
- origin のみ push。upstream (mnakada) は禁止
- compose recreate はイメージができてから。web-new npm は builder 周では走らせない
