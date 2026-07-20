#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Map every Random(n) call site in K.com.
Finds E8 calls targeting Random (mem 0x10DA), and reports the n value from a
preceding `mov ax, imm16` (B8 imm) when present."""
import sys
COM=r"C:\socher\socher\K.com"; ORIGIN=0x100; RANDOM=0x10DA

def main():
    data=open(COM,"rb").read()
    out=[]
    for i in range(len(data)-2):
        if data[i]==0xE8:
            rel=data[i+1]|(data[i+2]<<8)
            dst=((i+ORIGIN+3)+rel)&0xFFFF
            if dst==RANDOM:
                # look back up to 8 bytes for B8 imm16 (mov ax,imm)
                n=None
                for back in range(3,9):
                    j=i-back
                    if j>=0 and data[j]==0xB8:
                        n=data[j+1]|(data[j+2]<<8)
                        # ensure the mov ax is immediately the arg (closest B8)
                        break
                memo=i+ORIGIN
                out.append((i,memo,n))
    print(f"total Random() call sites: {len(out)}\n")
    for f,m,n in out:
        ns = f"Random({n})" if n is not None else "Random(?)"
        print(f"file 0x{f:04X}  mem 0x{m:04X}  {ns}")

if __name__=="__main__":
    main()
