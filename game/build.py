import pathlib
d = pathlib.Path(__file__).resolve().parent
root = d.parent
build = root/'build'          # test pages, git-ignored
build.mkdir(exist_ok=True)
shell = (d/'shell.html').read_text()
core = (d/'core.js').read_text()
# ui.js is kept as parts in ui/ and joined in this order. The parts share one scope:
# base.js opens the "(function () {" wrapper and loop.js closes it, so a part alone is not valid JS.
UI_PARTS = ['base', 'input', 'view', 'draw-fighters', 'draw-world', 'effects', 'finisher', 'manga',
            'screens', 'online', 'menus', 'acct', 'tutorial', 'loop']
ui = ''.join((d/'ui'/(n + '.js')).read_text() for n in UI_PARTS)
# the manga finisher pages: one script per fighter in game/manga/<id>.js, spliced at the end of ui/manga.js
ui = ui.replace('/*MANGA*/', '\n'.join(f.read_text() for f in sorted((d/'manga').glob('*.js'))))
ui = ui.replace('/*PORTRAITS*/{}', (d/'portraits'/'portraits.json').read_text())
ui = ui.replace('/*SKINFX*/', (d/'skinfx.js').read_text())
ui = ui.replace('/*SYNC*/', (d/'sync.js').read_text())   # account sync, the pure part (also a node module)
out = shell.replace('/*CORE*/', core).replace('/*UI*/', ui)
(build/'blastline.html').write_text(out)
skel = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + out + '</body></html>'
(build/'test.html').write_text(skel)
print(len(out), 'bytes')
mock = (d/'mock-room.js').read_text()
(build/'online-test.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body><script>' + mock + '</script>' + out + '</body></html>')
# Standalone website build: same game, plus the WebSocket network layer.
shim = (d/'net-ws.js').read_text()
cut = out.index('<div id="app">')
head_part, body_part = out[:cut], out[cut:]
first_script = body_part.index('<script>')
body_part = body_part[:first_script] + '<script>' + shim + '</script>\n' + body_part[first_script:]
web = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
       '<meta name="theme-color" content="#0e1022"><meta name="apple-mobile-web-app-capable" content="yes">'
       '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
       '<meta name="apple-mobile-web-app-title" content="PotatoBrawl">'
       '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png">'
       '<link rel="icon" type="image/png" href="/icon-192.png">'
       '<meta name="description" content="PotatoBrawl: a 1v1 platform fighter you can play against friends in the browser.">'
       '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
       + head_part + '</head><body>' + body_part + '</body></html>')
# three.min.js: nothing in the game loads it any more. It is still copied so the deploy blocks (cp -f index.html three.min.js ...)
# keep working unchanged; drop it, the copies here and the deploy lines together next round.
three = (root/'three.min.js').read_bytes()
(build/'three.min.js').write_bytes(three)
# index.html at the repo root is what the server deploys (deploy/update.txt copies it to public/).
(root/'index.html').write_text(web)
# public/ is what a local `node server.js` serves (git-ignored).
pub = root/'public'
pub.mkdir(exist_ok=True)
(pub/'index.html').write_text(web)
(pub/'three.min.js').write_bytes(three)
# web/ holds the home-screen app files (manifest, icons); the server serves them from public/ too.
for f in (root/'web').iterdir():
    (pub/f.name).write_bytes(f.read_bytes())
