/**
 * Deslocamento de um elemento "magnético". ${dx}/${dy} são a distância do cursor ao centro do elemento (px).
 * Fora do raio ele fica parado; dentro, anda na direção do cursor com força que cai até zero na borda do raio
 * (então não dá "pulo" ao entrar ou sair). O deslocamento máximo é strength × raio ÷ 4.
 */
export function magnetOffset(dx: number, dy: number, radius: number, strength = 0.35): { x: number; y: number } {
  const dist = Math.hypot(dx, dy);
  if (!(radius > 0) || dist >= radius) return { x: 0, y: 0 };
  const k = strength * (1 - dist / radius);
  return { x: dx * k, y: dy * k };
}
