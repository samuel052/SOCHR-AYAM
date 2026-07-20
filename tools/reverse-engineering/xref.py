#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Scan code region for 16-bit words that point into the string/data region,
and map each pointer to the string at/after that address. Builds an xref map."""
import sys

COM = r"C:\socher\socher\K.com"
ORIGIN = 0x100

def decode_byte(b):
    if 0x20 <= b <= 0x7E: return chr(b)
    if 0x80 <= b <= 0x9A: return bytes([b]).decode("cp862")
    return None

def string_at(data, foff):
    chars=[]; i=foff
    while i < len(data):
        c=decode_byte(data[i])
        if c is None: break
        chars.append(c); i+=1
    s="".join(chars)
    if any('֐'<=c<='׿' for c in s):
        s=s[::-1]
    return s

def main():
    data=open(COM,"rb").read()
    code_lo=int(sys.argv[1],16) if len(sys.argv)>1 else 0x2C7C
    code_hi=int(sys.argv[2],16) if len(sys.argv)>2 else 0x7556
    str_lo=int(sys.argv[3],16) if len(sys.argv)>3 else 0x7036
    str_hi=int(sys.argv[4],16) if len(sys.argv)>4 else 0xCB60
    out=sys.argv[5] if len(sys.argv)>5 else None
    res=[]
    for i in range(code_lo, code_hi-1):
        w = data[i] | (data[i+1]<<8)
        tgt = w - ORIGIN  # file offset pointed to
        if str_lo <= tgt < str_hi:
            # is tgt the start of (or 1 byte before) a printable string?
            for d in (0,1):
                ff=tgt+d
                if 0<=ff<len(data) and decode_byte(data[ff]) is not None:
                    s=string_at(data,ff)
                    if len(s)>=4 and any('֐'<=c<='׿' for c in s):
                        res.append((i, tgt, s[:50]))
                        break
    lines=[f"code 0x{ci:04X} -> data 0x{tgt:04X}  \"{s}\"" for ci,tgt,s in res]
    text="\n".join(lines)+"\n"
    if out:
        open(out,"w",encoding="utf-8").write(text)
        print(f"{len(res)} xrefs")
    else:
        sys.stdout.reconfigure(encoding="utf-8"); print(text)

if __name__=="__main__":
    main()
