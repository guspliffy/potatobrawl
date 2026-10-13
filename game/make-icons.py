# Writes the home-screen app icons into web/ from the Phoenix portrait. Run once after changing the art:
#   python3 game/make-icons.py
# The face sits in the middle 60%, so the same square also works as an Android "maskable" icon.
import pathlib
from PIL import Image, ImageDraw
d = pathlib.Path(__file__).resolve().parent
out = d.parent / 'web'
out.mkdir(exist_ok=True)
src = Image.open(d / 'portraits' / 'phoenix.jpg').convert('RGB')
w, h = src.size
s = min(w, h) - 8
sq = src.crop(((w - s) // 2, 4, (w - s) // 2 + s, 4 + s))
for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
    sq.resize((size, size), Image.LANCZOS).save(out / name, optimize=True)
print('icons written to', out)
