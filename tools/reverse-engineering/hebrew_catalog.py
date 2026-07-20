#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Produce a readable (logical-order) catalog of Hebrew game strings."""
import sys

COM = r"C:\socher\socher\K.com"

def decode_byte(b):
    if 0x20 <= b <= 0x7E:
        return chr(b)
    if 0x80 <= b <= 0x9A:
        return bytes([b]).decode("cp862")
    return None

def main():
    data = open(COM, "rb").read()
    minoff = int(sys.argv[1], 16) if len(sys.argv) > 1 else 0x7000
    out = sys.argv[2] if len(sys.argv) > 2 else None
    i = 0
    runs = []
    n = len(data)
    while i < n:
        c = decode_byte(data[i])
        if c is not None:
            start = i
            chars = []
            while i < n:
                cc = decode_byte(data[i])
                if cc is None:
                    break
                chars.append(cc)
                i += 1
            if len(chars) >= 4 and start >= minoff:
                s = "".join(chars)
                has_heb = any('֐' <= ch <= '׿' for ch in s)
                logical = s[::-1] if has_heb else s
                runs.append((start, logical))
        else:
            i += 1
    lines = [f"0x{off:04X}  {s}" for off, s in runs]
    text = "\n".join(lines) + "\n"
    if out:
        open(out, "w", encoding="utf-8").write(text)
        print(f"wrote {len(lines)} strings")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text)

if __name__ == "__main__":
    main()
