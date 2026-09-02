import { deflateSync } from "node:zlib";

const WIDTH = 1200;
const HEIGHT = 630;
const PALETTES = {
  1: [122, 162, 247],
  2: [125, 196, 168],
  3: [154, 143, 216],
  4: [199, 152, 100],
  5: [108, 184, 192],
  6: [195, 125, 147],
  7: [154, 182, 111],
};

const FONT = {
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","10000","11110","00001","00001","11110"],
  "6": ["01110","10000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00001","01110"],
  "@": ["01110","10001","10111","10101","10111","10000","01110"],
  ".": ["00000","00000","00000","00000","00000","00110","00110"],
  "_": ["00000","00000","00000","00000","00000","00000","11111"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"],
  "A": ["01110","10001","10001","11111","10001","10001","10001"],
  "B": ["11110","10001","10001","11110","10001","10001","11110"],
  "C": ["01111","10000","10000","10000","10000","10000","01111"],
  "D": ["11110","10001","10001","10001","10001","10001","11110"],
  "E": ["11111","10000","10000","11110","10000","10000","11111"],
  "F": ["11111","10000","10000","11110","10000","10000","10000"],
  "G": ["01111","10000","10000","10111","10001","10001","01111"],
  "I": ["11111","00100","00100","00100","00100","00100","11111"],
  "K": ["10001","10010","10100","11000","10100","10010","10001"],
  "L": ["10000","10000","10000","10000","10000","10000","11111"],
  "N": ["10001","11001","10101","10011","10001","10001","10001"],
  "O": ["01110","10001","10001","10001","10001","10001","01110"],
  "P": ["11110","10001","10001","11110","10000","10000","10000"],
  "R": ["11110","10001","10001","11110","10100","10010","10001"],
  "S": ["01111","10000","10000","01110","00001","00001","11110"],
  "T": ["11111","00100","00100","00100","00100","00100","00100"],
  "V": ["10001","10001","10001","10001","10001","01010","00100"],
  "W": ["10001","10001","10001","10101","10101","10101","01010"],
  "Y": ["10001","10001","01010","00100","00100","00100","00100"],
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const index = (y * WIDTH + x) * 3;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
}

function fillRect(pixels, x, y, w, h, color) {
  for (let yy = Math.max(0, y); yy < Math.min(HEIGHT, y + h); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(WIDTH, x + w); xx += 1) setPixel(pixels, xx, yy, color);
  }
}

function strokeRect(pixels, x, y, w, h, thickness, color) {
  fillRect(pixels, x, y, w, thickness, color);
  fillRect(pixels, x, y + h - thickness, w, thickness, color);
  fillRect(pixels, x, y, thickness, h, color);
  fillRect(pixels, x + w - thickness, y, thickness, h, color);
}

function line(pixels, x0, y0, x1, y1, thickness, color) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    fillRect(pixels, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function circle(pixels, cx, cy, radius, thickness, color) {
  for (let a = 0; a < 360; a += 1) {
    const rad = a * Math.PI / 180;
    const x = Math.round(cx + Math.cos(rad) * radius);
    const y = Math.round(cy + Math.sin(rad) * radius);
    fillRect(pixels, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, color);
  }
}

function drawText(pixels, text, x, y, scale, color) {
  let cursor = x;
  for (const raw of text) {
    const char = raw.toUpperCase();
    const glyph = FONT[char] ?? FONT[" "];
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        if (glyph[row][col] === "1") fillRect(pixels, cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

export function renderCertificateCard(capability = 1) {
  const ordinal = Number(capability);
  const accent = PALETTES[ordinal] ?? PALETTES[1];
  const bg = [9, 12, 15];
  const surface = [15, 20, 25];
  const frame = [40, 50, 60];
  const white = [242, 245, 247];
  const muted = [143, 155, 166];

  const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = bg[0]; pixels[i + 1] = bg[1]; pixels[i + 2] = bg[2];
  }

  fillRect(pixels, 38, 38, 1124, 554, surface);
  strokeRect(pixels, 38, 38, 1124, 554, 2, frame);
  line(pixels, 190, 92, 190, 538, 2, frame);

  circle(pixels, 118, 148, 42, 2, accent);
  const spokes = 5 + (ordinal % 4);
  for (let i = 0; i < spokes; i += 1) {
    const angle = (Math.PI * 2 * i / spokes) - Math.PI / 2;
    const x = Math.round(118 + Math.cos(angle) * 31);
    const y = Math.round(148 + Math.sin(angle) * 31);
    line(pixels, 118, 148, x, y, 2, accent);
    fillRect(pixels, x - 4, y - 4, 8, 8, accent);
  }

  drawText(pixels, `C${ordinal}`, 74, 232, 11, accent);
  drawText(pixels, "FLOP", 240, 94, 10, white);
  drawText(pixels, "VERIFIED WORKING CAPABILITY", 242, 182, 4, accent);
  drawText(pixels, "PORTABLE PUBLIC PROOF", 242, 292, 6, white);
  line(pixels, 242, 384, 1094, 384, 2, frame);
  drawText(pixels, "@FLOP_LABS", 242, 430, 4, white);
  drawText(pixels, "FLOP-STATUS.VERCEL.APP", 242, 482, 3, muted);

  circle(pixels, 1052, 490, 38, 2, accent);
  drawText(pixels, "PASS", 1018, 480, 3, accent);

  const stride = WIDTH * 3;
  const scanlines = Buffer.alloc((stride + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const target = y * (stride + 1);
    scanlines[target] = 0;
    pixels.copy(scanlines, target + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export default function handler(request, response) {
  const capability = Math.min(7, Math.max(1, Number(request.query?.capability) || 1));
  const image = renderCertificateCard(capability);
  response.setHeader("content-type", "image/png");
  response.setHeader("cache-control", "public, max-age=86400, s-maxage=86400");
  response.status(200).send(image);
}
