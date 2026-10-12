import re, sys

cyr = re.compile(r'[\u0400-\u04FF]')

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        clean = line.strip()
        if clean.startswith('//') or clean.startswith('*') or clean.startswith('/*'):
            continue
        code = clean.split('//')[0]
        if cyr.search(code):
            print(f"{i}: {code}")
