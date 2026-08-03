ENTRY(_start)
SECTIONS
{
  . = 0x80ca0000;
  .text : { *(.start) *(.text*) }
  .rodata : { *(.rodata*) }
  .data : { *(.data*) }
  /DISCARD/ : { *(.reginfo) *(.MIPS.abiflags) *(.comment) *(.note*) *(.pdr) *(.gnu.attributes) }
}
