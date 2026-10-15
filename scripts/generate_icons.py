import math
from pathlib import Path
import struct
import zlib


def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))


def make_icon(size):
    rows = bytearray()
    for row in range(size):
        rows.append(0)
        for column in range(size):
            horizontal = (column + 0.5) / size - 0.5
            vertical = (row + 0.5) / size - 0.46
            distance = math.hypot(horizontal, vertical)
            angle = math.atan2(vertical, horizontal)
            ray = 0.245 < distance < 0.295 and abs(math.sin(angle * 6)) < 0.17
            sun = distance < 0.18
            horizon = abs(horizontal) < 0.26 and (abs(vertical - 0.25) < 0.012 or abs(vertical - 0.31) < 0.009)
            rows.extend((239, 117, 78) if sun or ray else (247, 246, 242) if horizon else (21, 41, 64))
    header = struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')


if __name__ == '__main__':
    directory = Path(__file__).resolve().parents[1] / 'icons'
    directory.mkdir(exist_ok=True)
    for size in (180, 192, 512):
        (directory / f'icon-{size}.png').write_bytes(make_icon(size))
