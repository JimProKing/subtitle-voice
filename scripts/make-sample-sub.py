from PIL import Image, ImageDraw, ImageFont

img = Image.new("RGB", (1280, 720), (16, 18, 24))
draw = ImageDraw.Draw(img)
for y in range(720):
    shade = 16 + (y // 40) % 2 * 8
    draw.line([(0, y), (1280, y)], fill=(shade + 8, shade, 20 + y // 30))

font = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 52)
text = "이제 출발해야 해"
bbox = draw.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
x = (1280 - tw) // 2
y = 720 - 96
draw.text((x, y), text, font=font, fill=(255, 255, 255), stroke_width=5, stroke_fill=(0, 0, 0))
img.save("scripts/sample-sub.png")

w, h = img.size
band = img.crop((int(w * 0.07), int(h * 0.74), int(w * 0.93), h))
gray = band.convert("L")
prep = gray.point(lambda p: 0 if p > 185 else 255).convert("RGB")
prep = prep.resize((prep.width * 2, prep.height * 2), Image.Resampling.NEAREST)
prep.save("scripts/sample-sub-prep.png")

bw = Image.new("RGB", (900, 160), (255, 255, 255))
d2 = ImageDraw.Draw(bw)
d2.text((40, 40), text, font=font, fill=(0, 0, 0))
bw.save("scripts/sample-sub-bw.png")
print("wrote sample images")
