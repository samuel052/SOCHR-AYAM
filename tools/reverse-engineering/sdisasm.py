#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smart disassembler for K.com that auto-skips inline length-prefixed strings
(TP3 convention: [len byte][len chars]) to avoid desync, and annotates FP/Random/vars.
Usage: python sdisasm.py <start_mem_hex> <end_mem_hex>   (MEM addresses, e.g. 0x9D87)"""
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_16
COM=r"C:\socher\socher\K.com"; ORIGIN=0x100
data=open(COM,"rb").read()
md=Cs(CS_ARCH_X86,CS_MODE_16)

def tpreal(b6):
    if b6[0]==0:return 0.0
    s=-1 if(b6[5]&0x80)else 1
    m=b6[1]|(b6[2]<<8)|(b6[3]<<16)|(b6[4]<<24)|((b6[5]&0x7f)<<32)
    return s*(1.0+m/2.0**39)*2.0**(b6[0]-129)

FP={0x10da:"Random",0x1ad4:"RandReal",0x1973:"FLoad",0x1982:"FLoadConst",0x1993:"FStore",
0x19a6:"FAdd",0x19c1:"FSub",0x19d0:"FMul",0x19df:"FDiv",0x1a0e:"F=",0x1a76:"F>",0x1a42:"F>=",
0x1a5c:"F<=",0x1a90:"F<",0x1a28:"F!=",0x1afa:"Trunc",0x1af6:"Round",0x1b2f:"Float",0x1b38:"Float2",
0x4648:"cargoVal",0x5cc9:"loseCargo%",0x2dc6:"BGI_PutImage",0x8d76:"pirateEncounter",0x9caa:"hazardProb"}
VARS={0x2b9:"cash",0x2bf:"BANK",0x2b3:"dmg",0x2f8:"crg1",0x2fa:"crg2",0x2fc:"crg3",
0x2af:"day",0x2c9:"prevEvt",0x2d4:"ctr1",0x2d6:"ctr2",0x2d8:"ctr3",0x2b1:"capacity?"}

def dec(b):
    if 0x80<=b<=0x9a: return bytes([b]).decode("cp862")
    if 0x20<=b<=0x7e: return chr(b)
    return None

def looks_str(off, need_heb=False):
    """If data[off] is a length byte for an inline string, return length N (chars), else None."""
    if off>=len(data): return None
    n=data[off]
    if not (4<=n<=120): return None
    if off+1+n>len(data): return None
    printable=sum(1 for k in range(off+1,off+1+n) if dec(data[k]) is not None)
    heb=sum(1 for k in range(off+1,off+1+n) if 0x80<=data[k]<=0x9a)
    if printable<n-1 or printable<4: return None
    if need_heb and heb < max(3, n//3):  # require substantial Hebrew to skip mid-code
        return None
    return n

def render_str(off,n):
    s="".join(dec(data[off+1+k]) or '?' for k in range(n))
    if any('֐'<=c<='׿' for c in s): s=s[::-1]
    return s

def main():
    start=int(sys.argv[1],16)-ORIGIN
    end=int(sys.argv[2],16)-ORIGIN
    sys.stdout.reconfigure(encoding="utf-8")
    i=start
    while i<end:
        # First: is THIS position a Hebrew inline string (data, not code)? skip it.
        sl=looks_str(i, need_heb=True)
        if sl is not None:
            print(f'{i+ORIGIN:04X} .str       "{render_str(i,sl)}"')
            i+=sl+1; continue
        ins=next(md.disasm(data[i:i+8], i+ORIGIN), None)
        if ins is None:
            i+=1; continue
        note=""; skip_after=0
        if ins.mnemonic=='call' and ins.op_str.startswith('0x'):
            t=int(ins.op_str,16)
            if t in FP:
                note=f"  ; {FP[t]}"
                if t==0x1982:
                    note+=f" = {tpreal(data[i+ins.size:i+ins.size+6])}"; skip_after=6
            # after a call, an inline string may follow
            sl=looks_str(i+ins.size)
            if sl is not None and t not in (0x1982,):
                skip_after=sl+1
                note+=f'  ; +inline "{render_str(i+ins.size,sl)[:38]}"'
        for v,nm in VARS.items():
            if f"0x{v:x}" in ins.op_str: note+=f" <{nm}>"
        if ins.mnemonic not in ('push','pop','nop'):
            print(f"{ins.address:04X} {ins.bytes.hex():<10} {ins.mnemonic:7}{ins.op_str}{note}")
        i+=ins.size+skip_after

if __name__=="__main__":
    main()
