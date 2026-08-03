/* ATOMCam2 / Ingenic T31X  bare-metal LED probe v3
 *
 * GROUND TRUTH (all from the stock u-boot in NOR: ~/atomcam-backup/20260731-p0/mtd0.bin)
 *   misc_init_r @0x8012b330:  gpio_request(38,"yellow_gpio"); gpio_direction_output(38, 0)
 *                             gpio_request(39,"blue_gpio");   gpio_direction_output(39, 1)
 *     -> observed: yellow lights up, blue stays dark  ==> ACTIVE-LOW confirmed.
 *   gpio_direction_output(g,v) @0x80112e6c -> 0x80112d9c:
 *     port = g>>5 ; pin = g&31 ; base = 0xb0010000 + (port<<12)      <-- stride 0x1000
 *     *(base+0x18) = 1<<pin   (PXINTC : not-interrupt)
 *     *(base+0x24) = 1<<pin   (PXMSKS : gpio mode)
 *     *(base+0x38) = 1<<pin   (PXPAT1C: output)
 *     v ? *(base+0x44)=1<<pin (PXPAT0S: drive HIGH = LED OFF)
 *       : *(base+0x48)=1<<pin (PXPAT0C: drive LOW  = LED ON)
 *   gpio38 -> port1(PB) pin6 ; gpio39 -> port1(PB) pin7 ; PB base = 0xB0011000.
 *
 * The v1 probe used 0xB0010100 (stride 0x100 assumed) and therefore wrote to
 * PORT A pull/drive-strength registers.  It could never change any LED.
 */
#define PB      ((volatile unsigned int *)0xB0011000u)
#define YEL     (1u << 6)          /* gpio38 */
#define BLU     (1u << 7)          /* gpio39 */

#define LOADADDR   0x80ca0000u     /* == uImage ih_load / ih_ep */
#define MAG1_OFF   0x00200000u     /* 2 MiB into the payload */
#define MAG2_OFF   0x0042EAF0u     /* ih_size(0x42EB00) - 16   */
#define MAG1       0xA5A5C0DEu
#define MAG2       0x5A5A1234u

#define TICK       80000000u       /* ~0.5 s at ~1 GHz, 7 insn/iter */

void blink(void) __attribute__((noreturn));

static void dly(unsigned int n)
{
  volatile unsigned int i;
  for (i = 0; i < n; i++)
    __asm__ __volatile__("nop");
}

/* u-boot's do_bootm_linux jumps here with an undefined sp.
   Plant a stack ABOVE the 4.38 MB payload (payload ends 0x810CEB00). */
void __attribute__((section(".start"), naked, noreturn)) _start(void)
{
  __asm__ __volatile__(
    "li  $sp, 0x81200000\n\t"
    "j   blink\n\t"
    "nop\n\t");
}

void blink(void)
{
  const unsigned int both = YEL | BLU;
  volatile unsigned int *m1 = (volatile unsigned int *)(LOADADDR + MAG1_OFF);
  volatile unsigned int *m2 = (volatile unsigned int *)(LOADADDR + MAG2_OFF);
  unsigned int ok, k;

  PB[0x18/4] = both;   /* PXINTC  */
  PB[0x24/4] = both;   /* PXMSKS  */
  PB[0x38/4] = both;   /* PXPAT1C -> output */

  /* PHASE 0: both LEDs ON simultaneously. The stock u-boot NEVER produces
     this state (it drives yellow low, blue high), so seeing it proves that
     u-boot handed control to this payload. */
  PB[0x48/4] = both;
  for (k = 0; k < 8; k++)
    dly(TICK);

  ok = (*m1 == MAG1) && (*m2 == MAG2);

  if (ok) {
    /* PHASE 1-OK: yellow and blue ALTERNATE.  Proves the full 4.38 MB
       image was read from FAT and relocated to 0x80ca0000 intact. */
    for (;;) {
      PB[0x48/4] = YEL; PB[0x44/4] = BLU;
      dly(TICK);
      PB[0x44/4] = YEL; PB[0x48/4] = BLU;
      dly(TICK);
    }
  } else {
    /* PHASE 1-NG: both blink TOGETHER.  Payload runs but the image body
       is truncated / corrupted. */
    for (;;) {
      PB[0x48/4] = both;
      dly(TICK);
      PB[0x44/4] = both;
      dly(TICK);
    }
  }
}
