#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Linear disassembly of K.com (16-bit real mode, COM origin 0x100).
Annotates memory operands and immediates that match known string offsets.
Usage: python disasm.py <start_file_off_hex> <end_file_off_hex> [out.txt]
Offsets are FILE offsets. Memory addr = file_off + 0x100.
"""
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_16

COM = r"C:\socher\socher\K.com"
ORIGIN = 0x100

def load():
    with open(COM, "rb") as f:
        return f.read()

def cp862_run(data, mem_off):
    """Return decoded (reversed) hebrew/ascii string starting at file offset, or None."""
    foff = mem_off - ORIGIN
    if foff < 0 or foff >= len(data):
        return None
    chars = []
    i = foff
    while i < len(data):
        b = data[i]
        if 0x20 <= b <= 0x7E:
            chars.append(chr(b))
        elif 0x80 <= b <= 0x9A:
            chars.append(bytes([b]).decode("cp862"))
        else:
            break
        i += 1
    if len(chars) >= 4:
        s = "".join(chars)
        # reverse hebrew visual order for readability
        return s
    return None

def main():
    data = load()
    start = int(sys.argv[1], 16)
    end = int(sys.argv[2], 16)
    out = sys.argv[3] if len(sys.argv) > 3 else None
    md = Cs(CS_ARCH_X86, CS_MODE_16)
    md.detail = False
    code = data[start:end]
    base = start + ORIGIN  # memory address of first byte
    lines = []
    for insn in md.disasm(code, base):
        foff = insn.address - ORIGIN
        annot = ""
        # try to annotate operands referencing string data
        op = insn.op_str
        # look for hex immediates / mem refs like 0x7656
        import re
        for m in re.findall(r'0x[0-9a-fA-F]+', op):
            val = int(m, 16)
            s = cp862_run(data, val)
            if s and any('֐' <= c <= '׿' for c in s):
                annot = f"   ; @0x{val:04X}-> \"{s[:40]}\""
                break
        lines.append(f"{foff:05X}:{insn.address:04X}  {insn.bytes.hex():<14} {insn.mnemonic:<7} {op}{annot}")
    text = "\n".join(lines) + "\n"
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {len(lines)} insns to {out}")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text)

if __name__ == "__main__":
    main()
