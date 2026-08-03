/* ATOMCam2 T31 LED probe: PB6(gpio38,yellow)/PB7(gpio39,blue) active-low
   usage: ledprobe on|off|y_on|y_off|b_on|b_off

   GPIO bank stride is 0x1000 (NOT 0x100). 一次証拠: 実機 NOR の u-boot,
   gpio_direction_output 実装が (0xb0010 + (gpio>>5)) << 12 を計算する
   (mtd0.bin @0x80112de8: srl v1,a0,0x5 / lui v0,0xb / addiu v0,v0,16 /
    addu v0,v1,v0 / sll v0,v0,0xc)。
   PORT B = phys 0x10011000。2026-08-03 以前の版は 0x10010100(PORT A)に
   書いていたため、LED は一切変化せず全テストが無効だった。 */
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>
#define PB_PHYS 0x10011000u
int main(int argc,char**argv){
  if(argc<2) return 1;
  int fd=open("/dev/mem",O_RDWR|O_SYNC); if(fd<0){perror("mem");return 1;}
  volatile unsigned *pb=mmap(0,0x1000,PROT_READ|PROT_WRITE,MAP_SHARED,fd,PB_PHYS);
  if(pb==MAP_FAILED){perror("mmap");return 1;}
  unsigned m=0xC0; const char*c=argv[1];
  if(!strncmp(c,"y",1)) m=0x40; else if(!strncmp(c,"b",1)) m=0x80;
  pb[0x18/4]=m;  /* PXINTC: not interrupt */
  pb[0x24/4]=m;  /* PXMSKS: gpio mode     */
  pb[0x38/4]=m;  /* PXPAT1C: output       */
  if(strstr(c,"off")) pb[0x44/4]=m; else pb[0x48/4]=m; /* PAT0S=high(off)/PAT0C=low(on) */
  return 0;
}
