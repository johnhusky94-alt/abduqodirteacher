#!/usr/bin/env python3
"""Builds the whole site into ONE file: dist/index.html"""
import json, pathlib
R = pathlib.Path(__file__).parent
S, V = R / 'src', R / 'vendor'
rd = lambda p: p.read_text(encoding='utf-8')
def js_data(name, obj):
    # JSON inside a <script>: never let "</script" or "<!--" appear literally
    s = json.dumps(obj, ensure_ascii=False).replace('</', '<\\/').replace('<!--', '<\\!--')
    return f'window.{name}={s};'
order = ['core', 'net', 'code', 'vocab', 'school', 'gui', 'run', 'student', 'games', 'teacher', 'main']
app = '\n'.join(f'/* ===== {n}.js ===== */\n' + rd(S / f'{n}.js') for n in order)
for n in order:
    assert '</script' not in rd(S / f'{n}.js'), n
html = f'''<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2340E0">
<title>Ingliz tili</title>
<style>
{rd(S / 'style.css')}
#netbar{{position:sticky;top:0;z-index:70;background:#FFE7A8;color:#4A3200;font-weight:700;text-align:center;padding:8px 16px;font-size:14px}}
</style>
</head>
<body>
<div id="banner"></div>
<div id="netbar" hidden>Internet yo‘q: javoblar telefonda saqlanib turibdi va internet qaytganda yuboriladi.</div>
<div class="app"><nav class="side" id="side" aria-label="Menu"></nav><main><div class="wrapc" id="main"></div></main></div>
<div id="modal"></div>
<div id="ov" class="ov" hidden></div>
<div id="doni"></div>
<div id="toast" aria-live="polite"></div>
<script>
{rd(V / 'grammar-engine.js')}
</script>
<script>
{rd(V / 'wc.js')}
</script>
<script>
{js_data('__ARCADE', json.loads(rd(V / 'arcade-bundle.json')))}
{js_data('__CASTLE_SRC', rd(V / 'castle.html'))}
{js_data('__UNIT6', rd(V / 'unit6.txt'))}
{js_data('__U12', rd(V / 'u12.gpack'))}
</script>
<script>
"use strict";
{app}
</script>
</body>
</html>
'''
# the site is served by GitHub Pages from the repository root
out = R.parent / 'index.html'
out.write_text(html, encoding='utf-8')
print(out, round(len(html.encode()) / 1024), 'KB')
