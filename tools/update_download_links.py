#!/usr/bin/env python3
"""Rewrite download links (README, landing page, report page) after a release."""
import argparse, pathlib, re

ap = argparse.ArgumentParser()
ap.add_argument('--version', required=True)
ap.add_argument('--asset', required=True)
ap.add_argument('--url', required=True)
ap.add_argument('--sha256', required=True)
ap.add_argument('--size', required=True)
a = ap.parse_args()

START, END = '<!-- DOWNLOAD:START -->', '<!-- DOWNLOAD:END -->'
block = f"""{START}
| نسخه | فایل APK | حجم (بایت) | SHA-256 |
|---|---|---|---|
| v{a.version} | [{a.asset}]({a.url}) | {a.size} | `{a.sha256}` |

[دانلود مستقیم APK]({a.url}) · [صفحهٔ انتشار](https://github.com/havedays67-ai/TivaChat-V-Flash/releases/tag/v{a.version})
{END}"""

for name in ['README.md']:
    p = pathlib.Path(name)
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8')
    if START in text and END in text:
        text = re.sub(re.escape(START) + r'.*?' + re.escape(END), block, text, flags=re.S)
    else:
        text += '\n\n' + block + '\n'
    p.write_text(text, encoding='utf-8')
    print('updated', name)

for name in ['index.html', 'report/index.html']:
    p = pathlib.Path(name)
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8')
    # update the canonical anchor + any data-download links
    text = re.sub(r'(href=")[^"]*TivaChat-V-Flash[^"]*\.apk(")', r'\g<1>' + a.url + r'\g<2>', text)
    text = re.sub(r'data-latest-version>[^<]*<', f'data-latest-version>{a.version}<', text)
    text = re.sub(r'data-latest-sha256>[^<]*<', f'data-latest-sha256>{a.sha256}<', text)
    text = re.sub(r'data-latest-size>[^<]*<', f'data-latest-size>{a.size}<', text)
    p.write_text(text, encoding='utf-8')
    print('updated', name)
print(a.url)
