#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extract readable strings (ASCII + Hebrew CP862) from K.com with offsets."""
import sys

COM = r"C:\socher\socher\K.com"

def load():
    with open(COM, "rb") as f:
        return f.read()

def is_printable(b):
    # printable ASCII
    if 0x20 <= b <= 0x7E:
        return True
    # CP862 Hebrew letters 0x80-0x9A, plus some punctuation up to 0xAF
    if 0x80 <= b <= 0x9A:
        return True
    return False

def decode_byte(b):
    if 0x20 <= b <= 0x7E:
        return chr(b)
    if 0x80 <= b <= 0x9A:
        # CP862: 0x80=alef ... map via cp862
        try:
            return bytes([b]).decode("cp862")
        except Exception:
            return "?"
    return "?"

def main():
    minlen = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    data = load()
    i = 0
    n = len(data)
    runs = []
    while i < n:
        if is_printable(data[i]):
            start = i
            chars = []
            while i < n and is_printable(data[i]):
                chars.append(decode_byte(data[i]))
                i += 1
            s = "".join(chars)
            if len(s) >= minlen:
                runs.append((start, s))
        else:
            i += 1
    out = sys.argv[2] if len(sys.argv) > 2 else None
    lines = [f"{off:6d}  0x{off:04X}  {s}" for off, s in runs]
    text = "\n".join(lines) + "\n"
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(text)
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text)

if __name__ == "__main__":
    main()
