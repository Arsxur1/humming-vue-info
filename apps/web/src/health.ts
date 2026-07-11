export type HealthState = 'checking' | 'ok' | 'down';

export interface ApiHealth {
  status: string;
  service: string;
  timestamp: string;
  uptimeSec: number;
}

export function healthLabel(state: HealthState): string {
  switch (state) {
    case 'checking':
      return 'Проверяем API…';
    case 'ok':
      return 'API работает';
    case 'down':
      return 'API недоступен — запусти `pnpm dev` или проверь порт 3001';
  }
}

export async function fetchHealth(): Promise<ApiHealth> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`health: HTTP ${res.status}`);
  return (await res.json()) as ApiHealth;
}
