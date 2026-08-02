import * as THREE from 'three';

function canvas(size = 128) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function hex(color) {
  return '#' + new THREE.Color(color).getHexString();
}

function shade(color, amount) {
  const c = new THREE.Color(color);
  c.offsetHSL(0, 0, amount);
  return '#' + c.getHexString();
}

/** Telhado com fileiras de telhas onduladas, como o desenho das casas. */
export function roofTexture(color) {
  const c = canvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex(color);
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = shade(color, -0.09);
  ctx.lineWidth = 3;
  const rows = 4;
  const cols = 8;
  const rowH = 128 / rows;
  const colW = 128 / cols;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH + rowH * 0.75;
    const offset = r % 2 ? colW / 2 : 0;
    ctx.beginPath();
    for (let i = -1; i <= cols; i++) {
      const x = i * colW + offset;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + colW / 2, y - rowH * 0.42, x + colW, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Bandeira do barco: o emblema da Baía Dourada — sol nascendo sobre a onda,
 * pintado em creme e amarelo sobre o verde-mar do casco.
 */
export function flagTexture() {
  const c = canvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2fa58f';
  ctx.fillRect(0, 0, 128, 128);

  // Sol de raios curtos, um pouco acima do meio.
  ctx.fillStyle = '#ffd35c';
  ctx.beginPath();
  ctx.arc(64, 54, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd35c';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 31, 54 + Math.sin(a) * 31);
    ctx.lineTo(64 + Math.cos(a) * 41, 54 + Math.sin(a) * 41);
    ctx.stroke();
  }

  // Duas ondas cremes cruzando a bandeira por baixo do sol.
  ctx.strokeStyle = '#fff3d9';
  ctx.lineWidth = 9;
  for (const y of [92, 110]) {
    ctx.beginPath();
    ctx.moveTo(4, y);
    for (let x = 4; x <= 124; x += 20) {
      ctx.quadraticCurveTo(x + 5, y - 9, x + 10, y);
      ctx.quadraticCurveTo(x + 15, y + 9, x + 20, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Sombra macia usada sob personagens e barco. */
export function shadowTexture() {
  const c = canvas(64);
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,0.32)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
