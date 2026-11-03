#!/bin/sh
# 重新裁剪中文字体：新作品的标题里出现新汉字时运行一次。
# 用法：sh tools/subset-fonts.sh <Noto Serif SC 完整 woff2 所在目录>
# 需要：pip install fonttools brotli
set -e
SRC="$1"
cd "$(dirname "$0")/.."
python3 - <<'PY' > /tmp/afterimage-chars.txt
import glob, re
t = ''
# 注释里的字不会显示出来，先去掉，字体能小一圈
for f in glob.glob('**/*.html', recursive=True) + glob.glob('js/*.js') + glob.glob('data/*.js'):
    s = open(f, encoding='utf8').read()
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    if f.endswith('.js'):
        s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
        s = re.sub(r'(^|\s)//[^\n]*', r'\1', s)
    else:
        s = re.sub(r'(^|\s)//[^\n]*', r'\1', s)   # 页面里 <script> 的注释
    t += s
print(''.join(sorted(set(c for c in t if ord(c) > 0x2000))) + ''.join(chr(i) for i in range(0x20, 0x7f)))
PY
for w in 400 600; do
  pyftsubset "$SRC/noto-serif-sc-chinese-simplified-$w-normal.woff2" --text-file=/tmp/afterimage-chars.txt --flavor=woff2 --output-file="assets/fonts/noto-serif-sc-$w.woff2"
done
ls -la assets/fonts
