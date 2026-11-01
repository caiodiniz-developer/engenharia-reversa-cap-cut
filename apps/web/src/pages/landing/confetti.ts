import { mulberry32 } from '@editor/core';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  /** Segundos de vida restantes. */
  life: number;
  hue: number;
}

/** Cria ${count} partículas saindo de ${origin} em leque para cima. A mesma semente dá sempre o mesmo confete. */
export function makeParticles(count: number, seed: number, origin: { x: number; y: number }): Particle[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => {
    const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 0.9;
    const speed = 380 + rnd() * 420;
    return {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: rnd() * Math.PI * 2,
      vr: (rnd() - 0.5) * 14,
      size: 6 + rnd() * 7,
      life: 1.6 + rnd() * 1.0,
      hue: Math.round(rnd() * 360),
    };
  });
}

/** Avança ${dt} segundos: gravidade, resistência do ar e giro. Quem já passou da vida sai da lista. Não altera a lista original. */
export function stepParticles(ps: Particle[], dt: number, gravity = 900): Particle[] {
  const drag = Math.pow(0.35, dt);
  const next: Particle[] = [];
  for (const p of ps) {
    const life = p.life - dt;
    if (life <= 0) continue;
    const vx = p.vx * drag;
    const vy = (p.vy + gravity * dt) * drag;
    next.push({ ...p, x: p.x + vx * dt, y: p.y + vy * dt, vx, vy, rot: p.rot + p.vr * dt, life });
  }
  return next;
}
