#!/usr/bin/env python3
"""
DoKit i18n Coverage Checker — PERMANENT GUARD
Run before every push: ensures every data-i18n key used in HTML
exists in the dictionaries. Missing keys cause "Hero title" style
placeholder bugs.

Usage: python3 scripts/i18n-coverage.py
Exit 0 = 100% coverage, Exit 1 = missing keys found
"""
import re, os, glob, sys

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

html_keys = {}
for f in glob.glob('**/*.html', recursive=True):
    if f.startswith('admin/'):
        continue
    with open(f, encoding='utf-8', errors='ignore') as fh:
        content = fh.read()
    for key in re.findall(r'data-i18n="([^"]+)"', content):
        if key not in html_keys:
            html_keys[key] = f

js_keys = set()
for jf in ['js/i18n-v2.js', 'js/i18n-meta.js', 'js/i18n-boardphoto.js']:
    if os.path.exists(jf):
        with open(jf, encoding='utf-8', errors='ignore') as fh:
            c = fh.read()
        js_keys.update(re.findall(r'"([a-zA-Z0-9_.-]+)":\s*"', c))

missing = sorted([(k, html_keys[k]) for k in html_keys if k not in js_keys])

if missing:
    print(f"❌ FAIL: {len(missing)} keys missing from dictionaries:")
    for k, f in missing[:20]:
        print(f"   {k} (used in {f})")
    if len(missing) > 20:
        print(f"   ... and {len(missing)-20} more")
    print("\nFix: add these keys to js/i18n-meta.js EN dict (and UR if translated).")
    sys.exit(1)
else:
    print(f"✅ PASS: {len(html_keys)} HTML keys, all present in dictionaries.")
    sys.exit(0)
