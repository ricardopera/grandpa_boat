import * as THREE from 'three';

// O visual do jogo é chapado: um material por cor, reaproveitado em toda a cena.
const cache = new Map();

export function flat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, ...options });
    cache.set(key, material);
  }
  return material;
}

// Materiais que serão animados ou terão opacidade própria não podem ser compartilhados.
export function flatUnique(color, options = {}) {
  return new THREE.MeshLambertMaterial({ color, ...options });
}

export function unlit(color, options = {}) {
  const key = `unlit|${color}|${JSON.stringify(options)}`;
  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color, ...options });
    cache.set(key, material);
  }
  return material;
}

export function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

/** Barra ligando dois pontos: evita ter de calcular ângulo a ângulo. */
export function beam(from, to, radius, material, segments = 7) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material
  );
  bar.position.copy(from).addScaledVector(direction, 0.5);
  bar.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  return bar;
}

// Retângulo com cantos arredondados: base de quase todas as formas do jogo.
export function roundedRectShape(width, height, radius) {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w, -h + r);
  return shape;
}

export function extrude(shape, depth, options = {}) {
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 12,
    ...options,
  });
}
