#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Decode Turbo Pascal 3 six-byte Real constants from K.com.
Usage:
  python tools/tpreal.py <file_off_hex>     # decode the 6-byte real at file offset
  python tools/tpreal.py scan               # scan for FLoadConst (call 0x1982) sites & decode their inline consts
TP3 Real: value = (-1)^sign * (1 + mant/2^39) * 2^(exp-129); exp==0 -> 0.
bytes: [exp][m0][m1][m2][m3][m4]; sign = bit7 of m4."""
import sys
COM=r"C:\socher\socher\K.com"; ORIGIN=0x100; FLOADCONST=0x1982

def tpreal(b6):
    if b6[0]==0: return 0.0
    sign=-1 if (b6[5]&0x80) else 1
    mant=b6[1]|(b6[2]<<8)|(b6[3]<<16)|(b6[4]<<24)|((b6[5]&0x7f)<<32)
    return sign*(1.0+mant/2.0**39)*2.0**(b6[0]-129)

def main():
    data=open(COM,"rb").read()
    if len(sys.argv)>1 and sys.argv[1]=="scan":
        for f in range(len(data)-2):
            if data[f]==0xE8:
                rel=data[f+1]|(data[f+2]<<8)
                if ((f+ORIGIN+3)+rel)&0xFFFF==FLOADCONST:
                    c=data[f+3:f+9]
                    print(f"FLoadConst @mem 0x{f+ORIGIN:04X}: {' '.join(f'{x:02x}' for x in c)} = {tpreal(c)}")
        return
    f=int(sys.argv[1],16)
    c=data[f:f+6]
    print(f"file 0x{f:04X}: {' '.join(f'{x:02x}' for x in c)} = {tpreal(c)}")

if __name__=="__main__":
    main()
