#!/usr/bin/env python3
"""
EasyOCR runner for FoodApp processing pipeline.
Reads a JSON array of image file paths from stdin.
Writes a JSON array of detected text strings to stdout.

Uses a single English/Latin-script reader — fast (~10s model load, cached after
first run). Restaurant names in food videos almost always appear in Latin script
even for Asian restaurants (e.g. "Baan Tepa", "Nobu", "Din Tai Fung").
"""
import sys
import json
import os
import warnings

# Suppress harmless MPS/pin_memory warning on Apple Silicon
warnings.filterwarnings('ignore', message='.*pin_memory.*')

# Ensure model dir exists — EasyOCR bug: crashes removing temp.zip if dir missing
os.makedirs(os.path.expanduser('~/.EasyOCR/model'), exist_ok=True)


def main():
    try:
        paths = json.loads(sys.stdin.read())
    except Exception as e:
        sys.stderr.write(f"Input parse error: {e}\n")
        print("[]")
        return

    try:
        import easyocr
    except ImportError:
        sys.stderr.write("easyocr not installed. Run: pip install easyocr\n")
        print("[]")
        return

    # Single reader — Latin script covers virtually all food video text overlays.
    # Model is cached in ~/.EasyOCR/model after first download.
    try:
        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    except Exception as e:
        sys.stderr.write(f"EasyOCR reader init failed: {e}\n")
        print("[]")
        return

    all_text = []
    seen: set = set()

    for p in paths:
        try:
            lines = reader.readtext(p, detail=0, paragraph=False)
            for line in lines:
                line = line.strip()
                if line and line.lower() not in seen:
                    seen.add(line.lower())
                    all_text.append(line)
        except Exception as e:
            sys.stderr.write(f"Frame OCR error ({p}): {e}\n")

    print(json.dumps(all_text))


if __name__ == '__main__':
    main()
