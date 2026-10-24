export const ASPECTS = [
  { id: '16:9', label: '16:9 · Paisagem', width: 1920, height: 1080 },
  { id: '9:16', label: '9:16 · Vertical', width: 1080, height: 1920 },
  { id: '1:1', label: '1:1 · Quadrado', width: 1080, height: 1080 },
  { id: '4:5', label: '4:5 · Retrato', width: 1080, height: 1350 },
  { id: '4:3', label: '4:3 · Clássico', width: 1440, height: 1080 },
  { id: '21:9', label: '21:9 · Cinema', width: 2560, height: 1080 },
] as const;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  if (diff < 45) return 'agora há pouco';
  if (diff < 3600) return `há ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.round(diff / 3600)} h`;
  if (diff < 86400 * 30) return `há ${Math.round(diff / 86400)} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function aspectLabel(width: number, height: number): string {
  const hit = ASPECTS.find((a) => a.width === width && a.height === height);
  return hit ? hit.id : `${width}×${height}`;
}
