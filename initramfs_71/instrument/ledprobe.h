/* SPDX-License-Identifier: GPL-2.0 */
/*
 * arch/mips/include/asm/ledprobe.h
 *
 * ATOMCam2 / Ingenic T31X  ブート経路 LED 計装 (UART なしで到達点を可視化する)
 *
 * ---- ハードウェア根拠 (純正 u-boot mtd0.bin の逆アセンブルより) ----------
 *   gpio_direction_output(g,v)  実体 0x80112d9c:
 *     port = g>>5 ; pin = g&31 ; base = 0xb0010000 + (port<<12)   <- stride 0x1000
 *     *(base+0x18) = 1<<pin   PXINTC  : 割り込みでなく GPIO
 *     *(base+0x24) = 1<<pin   PXMSKS  : GPIO モード
 *     *(base+0x38) = 1<<pin   PXPAT1C : 出力
 *     *(base+0x44) = 1<<pin   PXPAT0S : HIGH ドライブ = LED 消灯
 *     *(base+0x48) = 1<<pin   PXPAT0C : LOW  ドライブ = LED 点灯   (active-low)
 *   黄 = GPIO38 = PB6 / 青 = GPIO39 = PB7 / PORT B base = 0xB0011000 (KSEG1)
 *
 *   u-boot の misc_init_r は gpio_direction_output(38,0)=黄点灯 /
 *   (39,1)=青消灯 を行う。つまり「黄のみ点灯」が u-boot の平常状態であり、
 *   計装のラッチには絶対に使ってはならない (区別が付かなくなる)。
 *
 * KSEG1 なのでキャッシュ操作は不要。sp / gp / a0-a3 / s0-s3 / ra を一切
 * 使わないので、ブートの最初の 1 命令目からでも安全に呼べる。
 * 使用レジスタは t0-t3 (整合性チェックのみ追加で t4-t6)。
 *
 * ============================ 読み方 ====================================
 *
 *   ★ どちらの LED が「点きっぱなし」かで、進捗か異常かが決まる ★
 *
 *   [進捗] 青が点きっぱなしの枠の中で、黄が N 回ゆっくり点滅する
 *          -> 到達段階 = N。1 回だけ流れて、次の段階まで「ラッチ」で待つ
 *   [異常] 黄が点きっぱなしの枠の中で、青が N 回ゆっくり点滅する
 *          -> 異常コード = EN。これを永久に繰り返す (止まらない)
 *
 *   進捗の段階:
 *   段階 : 場所                                        : 黄の点滅 : ラッチ
 *   S1   : zboot head.S の 1 命令目 (bootm 直後)        :  1 回   : 青のみ
 *   S2   : zboot BSS クリア完了 (解凍を始める直前)      :  2 回   : 両方
 *   S3   : decompress_kernel() から復帰 (解凍完了)      :  3 回   : 青のみ
 *   S4   : kernel_entry の 1 命令目 (解凍後カーネル)    :  4 回   : 両方
 *   S5   : kernel/head.S 末尾 (BSS/fw_arg/gp/sp 確立)   :  5 回   : 青のみ
 *   S6   : start_kernel() の 1 文目 (C コード到達)      :  6 回   : 両方
 *
 *   異常コード:
 *   E1 : 圧縮イメージ末尾 4 バイトが不一致
 *        = 4.38MB が DRAM に完全には届いていない (SD/FAT か bootm の memmove)
 *   E2 : LZMA が error() を呼んだ (data corrupt / unexpected EOF / bad header
 *        / stack-protector)。従来は完全に無音の while(1) だった経路
 *   E3 : __decompress() が非ゼロを返した = error() を呼ばずに黙って失敗した
 *        (goto exit_3 / large_malloc が NULL)。従来は戻り値を捨てていた
 *   E4 : 解凍は成功を主張したが、解凍後イメージのカーネル入口ワードが
 *        期待値と違う = 中身が壊れている
 *
 *   ★ラッチには「黄のみ」も「消灯」も使わない。
 *     黄のみ = u-boot の平常状態、消灯 = 電源断と区別が付かないため。
 *     使うのは「青のみ」(奇数段) と「両方」(偶数段) の 2 つだけ。
 *     どちらも u-boot には作れない状態なので、数え損ねても
 *     「奇数段まで行った / 偶数段まで行った」だけは必ず残る。
 *
 *   ★段階と段階の間には必ず「両方消灯」の間があく。これは区切りであって
 *     状態ではない。ハングした時点のラッチがそのまま永久に残る。
 *
 *   撮影必須: 電源投入の瞬間からスマホで動画を撮ること。6 段階まで
 *   数えられ、同時に最初の「両方消灯」の実時間から LEDP_UNIT を較正できる
 *   (設計値 1 単位 = 0.2 s、最初の区切り = 4 単位 = 0.8 s @ CPU 1GHz)。
 *
 * ---- 無効化 -------------------------------------------------------------
 *   LEDPROBE_ON を 0 にして再ビルドすると全挿入箇所が消える。
 *   完全に元へ戻すには ~/atomcam71/instrument/revert.sh を実行する。
 */
#ifndef __ASM_LEDPROBE_H
#define __ASM_LEDPROBE_H

/* 1 = 計装あり / 0 = 何も生成しない */
#ifndef LEDPROBE_ON
#define LEDPROBE_ON	1
#endif

#define LEDP_PB		0xb0011000	/* PORT B, KSEG1 */
#define LEDP_YEL	0x40		/* PB6 = GPIO38 = 黄 */
#define LEDP_BLU	0x80		/* PB7 = GPIO39 = 青 */
#define LEDP_BOTH	0xc0

#define LEDP_INTC	0x18
#define LEDP_MSKS	0x24
#define LEDP_PAT1C	0x38
#define LEDP_PAT0S	0x44		/* HIGH = 消灯 */
#define LEDP_PAT0C	0x48		/* LOW  = 点灯 */

/*
 * 1 単位の長さ。アセンブラ側の遅延ループは 3 命令/回。
 * 0x04000000 = 67,108,864 回 -> 約 2 億サイクル -> CPU 1GHz で約 0.2 s。
 * (点滅は 2 単位 ON + 2 単位 OFF = 約 0.8 s 周期)
 *
 * CPU クロックは未確定。実機の最初の「両方消灯」を実測して 0.8 s から
 * 大きくずれていたら、その比でここだけ増減して再ビルドする。
 */
#define LEDP_UNIT	0x04000000
/* C 側の遅延ループは volatile 変数のせいで約 7-8 命令/回 -> 3/8 に縮める */
#define LEDP_UNIT_C	0x01800000

/*
 * ---- 自動生成される検証定数 (asm/ledprobe_tail.h) -----------------------
 *
 * LEDP_TAILWORD : 圧縮イメージ (.image = vmlinux.bin.z) の末尾 4 バイト。
 *   scripts/Makefile.lib の lzma_with_size が「解凍後サイズ」を LE で書く。
 *   ここが読めれば 4.38MB のペイロードが末尾まで DRAM に届いた証拠になる。
 * LEDP_ENTRYADDR / LEDP_ENTRYWORD : 解凍後カーネルの入口 (KERNEL_ENTRY) と、
 *   そこに置かれているはずの最初の命令ワード。解凍結果の中身を照合する。
 *   S4 の計装により kernel_entry の 1 命令目は lui t0,0xb001 = 0x3c08b001。
 *
 * ★重要★ どちらもカーネルを再ビルドするたびに変わる。必ずビルド後に
 * ~/atomcam71/instrument/refresh-tail.sh を実行して ledprobe_tail.h を
 * 作り直し、もう一度ビルドすること。ledprobe_tail.h は compressed/ の
 * head.S と decompress.c からしか include しないので、作り直しても
 * vmlinux 本体は変化せず、値は 1 回で収束する。
 *
 * 0 のときは、そのチェックを丸ごと省略する。
 */
#ifndef LEDP_TAILWORD
#define LEDP_TAILWORD	0
#endif
#ifndef LEDP_ENTRYADDR
#define LEDP_ENTRYADDR	0
#endif
#ifndef LEDP_ENTRYWORD
#define LEDP_ENTRYWORD	0
#endif

#ifdef __ASSEMBLY__

	/* 両ピンを GPIO 出力にして消灯。clobber: t0,t1 */
	.macro	ledp_cfg
	li	t0, LEDP_PB
	li	t1, LEDP_BOTH
	sw	t1, LEDP_INTC(t0)
	sw	t1, LEDP_MSKS(t0)
	sw	t1, LEDP_PAT1C(t0)
	sw	t1, LEDP_PAT0S(t0)
	.endm

	/* 点灯 (LOW ドライブ)。clobber: t0,t1 */
	.macro	ledp_on m
	li	t0, LEDP_PB
	li	t1, (\m)
	sw	t1, LEDP_PAT0C(t0)
	.endm

	/* 消灯 (HIGH ドライブ)。clobber: t0,t1 */
	.macro	ledp_off m
	li	t0, LEDP_PB
	li	t1, (\m)
	sw	t1, LEDP_PAT0S(t0)
	.endm

	/* \n 単位の遅延。clobber: t2 */
	.macro	ledp_dly n
	.set	push
	.set	noreorder
	li	t2, (LEDP_UNIT) * (\n)
8:	addiu	t2, t2, -1
	bnez	t2, 8b
	 nop
	.set	pop
	.endm

	/*
	 * [進捗] 段階 \n を申告する: 青の枠の中で黄が \n 回点滅し、
	 * そのあとラッチ \lon を点灯して戻る。
	 * clobber: t0,t1,t2,t3   (a0-a3, s0-s3, sp, gp, ra は触らない)
	 */
	.macro	ledp_stage n, lon
	ledp_cfg			/* 区切り: 両方消灯 */
	ledp_dly 4
	ledp_on	 LEDP_BLU		/* 枠: 青を点灯しっぱなし */
	.set	push
	.set	noreorder
	li	t3, (\n)
	.set	pop
9:	ledp_on	 LEDP_YEL
	ledp_dly 2
	ledp_off LEDP_YEL
	ledp_dly 2
	.set	push
	.set	noreorder
	addiu	t3, t3, -1
	bnez	t3, 9b
	 nop
	.set	pop
	ledp_off LEDP_BOTH		/* 枠おわり: いったん両方消す */
	ledp_dly 2			/* ラッチが「変化」として見えるように */
	ledp_on	 \lon			/* ラッチ (青のみ or 両方) */
	.endm

	/*
	 * [異常] コード E\n を永久に繰り返す。黄の枠の中で青が \n 回点滅する。
	 * 進捗表示とは枠の色が逆なので一目で区別できる。戻らない。
	 * clobber: t0,t1,t2,t3
	 */
	.macro	ledp_fail n
	ledp_cfg
7:	ledp_off LEDP_BOTH		/* 区切り: 両方消灯 */
	ledp_dly 4
	ledp_on	 LEDP_YEL		/* 枠: 黄を点灯しっぱなし */
	.set	push
	.set	noreorder
	li	t3, (\n)
	.set	pop
5:	ledp_on	 LEDP_BLU
	ledp_dly 2
	ledp_off LEDP_BLU
	ledp_dly 2
	.set	push
	.set	noreorder
	addiu	t3, t3, -1
	bnez	t3, 5b
	 nop
	.set	pop
	ledp_off LEDP_YEL
	.set	push
	.set	noreorder
	b	7b
	 nop
	.set	pop
	.endm

	/*
	 * 圧縮イメージ末尾のサイズワードを検証する。不一致なら E1 で停止。
	 * .image は 1 バイト境界なので lwl/lwr で非アライン読み出しする
	 * (リトルエンディアン専用: LSB が -4(t4), MSB が -1(t4))。
	 * clobber: t0,t1,t2,t3,t4,t5,t6
	 */
	.macro	ledp_check_image
#if LEDP_TAILWORD != 0
	PTR_LA	t4, __image_end
	lwl	t5, -1(t4)
	lwr	t5, -4(t4)
	li	t6, LEDP_TAILWORD
	beq	t5, t6, 6f
	ledp_fail 1
6:
#endif	/* LEDP_TAILWORD */
	.endm

#else	/* !__ASSEMBLY__ : C から使う版 (S6 / decompress.c 用) */

#define LEDP_REG(o) \
	(*(volatile unsigned int *)((unsigned long)(LEDP_PB) + (unsigned long)(o)))

static inline void ledp_c_dly(unsigned int units)
{
	volatile unsigned int i;
	unsigned int u;

	for (u = 0; u < units; u++)
		for (i = 0; i < LEDP_UNIT_C; i++)
			;
}

static inline void ledp_c_cfg(void)
{
	LEDP_REG(LEDP_INTC)  = LEDP_BOTH;
	LEDP_REG(LEDP_MSKS)  = LEDP_BOTH;
	LEDP_REG(LEDP_PAT1C) = LEDP_BOTH;
	LEDP_REG(LEDP_PAT0S) = LEDP_BOTH;
}

/* [進捗] 青の枠 + 黄 n 回点滅 -> ラッチ lon */
static inline void ledp_c_stage(unsigned int n, unsigned int lon)
{
	unsigned int k;

	ledp_c_cfg();
	ledp_c_dly(4);
	LEDP_REG(LEDP_PAT0C) = LEDP_BLU;
	for (k = 0; k < n; k++) {
		LEDP_REG(LEDP_PAT0C) = LEDP_YEL;
		ledp_c_dly(2);
		LEDP_REG(LEDP_PAT0S) = LEDP_YEL;
		ledp_c_dly(2);
	}
	LEDP_REG(LEDP_PAT0S) = LEDP_BOTH;
	ledp_c_dly(2);
	LEDP_REG(LEDP_PAT0C) = lon;
}

/* [異常] 黄の枠 + 青 n 回点滅 を永久に繰り返す。戻らない */
static inline void ledp_c_fail(unsigned int n)
{
	unsigned int k;

	ledp_c_cfg();
	for (;;) {
		LEDP_REG(LEDP_PAT0S) = LEDP_BOTH;
		ledp_c_dly(4);
		LEDP_REG(LEDP_PAT0C) = LEDP_YEL;
		for (k = 0; k < n; k++) {
			LEDP_REG(LEDP_PAT0C) = LEDP_BLU;
			ledp_c_dly(2);
			LEDP_REG(LEDP_PAT0S) = LEDP_BLU;
			ledp_c_dly(2);
		}
		LEDP_REG(LEDP_PAT0S) = LEDP_YEL;
	}
}

#endif	/* __ASSEMBLY__ */
#endif	/* __ASM_LEDPROBE_H */
