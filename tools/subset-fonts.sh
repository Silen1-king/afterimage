#!/bin/sh
# 重新裁剪中文字体：新作品的标题里出现新汉字时运行一次。
# 用法：sh tools/subset-fonts.sh <Noto Serif SC 完整 woff2 所在目录>
# 需要：pip install fonttools brotli
set -e
SRC="$1"
cd "$(dirname "$0")/.."
python3 - <<'PY' > /tmp/afterimage-chars.txt
import glob
t = ''
for f in glob.glob('**/*.html', recursive=True) + glob.glob('js/*.js') + glob.glob('data/*.js'):
    t += open(f, encoding='utf8').read()
print(''.join(sorted(set(c for c in t if ord(c) > 0x2000))) + ''.join(chr(i) for i in range(0x20, 0x7f)))
PY
for w in 400 600; do
  pyftsubset "$SRC/noto-serif-sc-chinese-simplified-$w-normal.woff2" --text-file=/tmp/afterimage-chars.txt --flavor=woff2 --output-file="assets/fonts/noto-serif-sc-$w.woff2"
done
ls -la assets/fonts
