import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, getPixel) {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const idx = y * rowSize + 1 + x * 4;
      const [r, g, b, a] = getPixel(x, y);
      raw[idx] = Math.max(0, Math.min(255, Math.round(r)));
      raw[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      raw[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      raw[idx + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    table[i] = c >>> 0;
  }

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function renderOffGridPixel(nx, ny, isMaskable = false) {
  // nx, ny in [0, 512]
  // Return [r, g, b, a]

  // Rounded squircle check
  if (!isMaskable) {
    const margin = 0;
    const cornerR = 116;
    let inCard = false;
    if (nx >= margin && nx <= 512 - margin && ny >= margin && ny <= 512 - margin) {
      const qx = Math.max(margin + cornerR - nx, 0, nx - (512 - margin - cornerR));
      const qy = Math.max(margin + cornerR - ny, 0, ny - (512 - margin - cornerR));
      if (qx * qx + qy * qy <= cornerR * cornerR) {
        inCard = true;
      }
    }
    if (!inCard) return [0, 0, 0, 0];
  }

  // Card background gradient (#111b21 to #0b141a)
  const gradT = ny / 512;
  let bgR = 17 - gradT * 6;
  let bgG = 27 - gradT * 7;
  let bgB = 33 - gradT * 7;
  let bgA = 255;

  let r = bgR;
  let g = bgG;
  let b = bgB;
  let a = bgA;

  // Speech bubble body
  // Center (256, 260), radius 160
  const bubbleDist = Math.hypot(nx - 256, ny - 260);
  // Pointer triangle: (165, 385), (96, 408), (114, 340)
  const p1x = 165, p1y = 385;
  const p2x = 96, p2y = 408;
  const p3x = 114, p3y = 340;
  // Point in triangle check
  const d1 = (nx - p2x) * (p1y - p2y) - (p1x - p2x) * (ny - p2y);
  const d2 = (nx - p3x) * (p2y - p3y) - (p2x - p3x) * (ny - p3y);
  const d3 = (nx - p1x) * (p3y - p1y) - (p3x - p1x) * (ny - p1y);
  const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  const inTriangle = !(has_neg && has_pos);

  if (bubbleDist <= 160 || inTriangle) {
    // Brand gradient: #00D29E (0, 210, 158) to #008F6E (0, 143, 110)
    const bGrad = (ny - 100) / 320;
    r = 0;
    g = 210 - bGrad * 67;
    b = 158 - bGrad * 48;
  }

  // Status pulse dot on top right: (384, 128)
  const dotDist = Math.hypot(nx - 384, ny - 128);
  if (dotDist <= 16) {
    r = 37; g = 211; b = 102; // #25D366
  } else if (dotDist >= 22 && dotDist <= 26) {
    r = Math.round(r * 0.5 + 37 * 0.5);
    g = Math.round(g * 0.5 + 211 * 0.5);
    b = Math.round(b * 0.5 + 102 * 0.5);
  }

  // Inside bubble symbols:
  // Center node at (256, 302)
  const nodeDist = Math.hypot(nx - 256, ny - 302);
  if (nodeDist <= 18) {
    return [255, 255, 255, 255];
  }

  // Connected mesh nodes at (190, 334) and (322, 334)
  const mesh1Dist = Math.hypot(nx - 190, ny - 334);
  const mesh2Dist = Math.hypot(nx - 322, ny - 334);
  if (mesh1Dist <= 10 || mesh2Dist <= 10) {
    return [255, 255, 255, 255];
  }

  // Connecting lines
  const line1Dist = distToSegment(nx, ny, 190, 334, 256, 302);
  const line2Dist = distToSegment(nx, ny, 322, 334, 256, 302);
  if (line1Dist <= 3.5 || line2Dist <= 3.5) {
    return [245, 245, 245, 255];
  }

  // Middle wave arc
  // Origin (256, 302), radius ~62, angle from -150 to -30 deg (in standard math: y < 302)
  if (ny <= 285) {
    const arcDist = Math.hypot(nx - 256, ny - 302);
    const angle = Math.atan2(ny - 302, nx - 256) * (180 / Math.PI);
    if (angle >= -155 && angle <= -25) {
      if (Math.abs(arcDist - 65) <= 10) {
        return [255, 255, 255, 255];
      }
    }
  }

  // Outer wave arc
  if (ny <= 270) {
    const arcDist2 = Math.hypot(nx - 256, ny - 302);
    const angle2 = Math.atan2(ny - 302, nx - 256) * (180 / Math.PI);
    if (angle2 >= -150 && angle2 <= -30) {
      if (Math.abs(arcDist2 - 110) <= 10) {
        return [255, 255, 255, 255];
      }
    }
  }

  return [r, g, b, a];
}

function generateIcon(size, isMaskable = false) {
  return createPng(size, size, (x, y) => {
    // 2x2 supersampling for smooth antialiasing
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
    const offsets = [0.25, 0.75];
    for (const ox of offsets) {
      for (const oy of offsets) {
        const nx = ((x + ox) / size) * 512;
        const ny = ((y + oy) / size) * 512;
        const [pr, pg, pb, pa] = renderOffGridPixel(nx, ny, isMaskable);
        sumR += pr;
        sumG += pg;
        sumB += pb;
        sumA += pa;
      }
    }
    return [sumR / 4, sumG / 4, sumB / 4, sumA / 4];
  });
}

const publicDir = path.resolve('public');
console.log('Generating PWA icons in:', publicDir);

// 1. 192x192
const p192 = generateIcon(192, false);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), p192);
console.log('pwa-192x192.png generated:', p192.length, 'bytes');

// 2. 512x512
const p512 = generateIcon(512, false);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), p512);
console.log('pwa-512x512.png generated:', p512.length, 'bytes');

// 3. Apple Touch Icon 180x180
const pApple = generateIcon(180, false);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pApple);
console.log('apple-touch-icon.png generated:', pApple.length, 'bytes');

// 4. Maskable 512x512
const pMaskable = generateIcon(512, true);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pMaskable);
console.log('pwa-maskable-512x512.png generated:', pMaskable.length, 'bytes');

console.log('All icons generated successfully!');
