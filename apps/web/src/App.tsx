import { useEffect, useState } from 'react';
import { fetchHealth, healthLabel, type HealthState } from './health.js';

const colors: Record<HealthState, string> = {
  checking: '#b8860b',
  ok: '#1a7f37',
  down: '#c0392b',
};

export function App() {
  const [state, setState] = useState<HealthState>('checking');
  const [uptime, setUptime] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const health = await fetchHealth();
        if (!cancelled) {
          setState(health.status === 'ok' ? 'ok' : 'down');
          setUptime(health.uptimeSec);
        }
      } catch {
        if (!cancelled) setState('down');
      }
    };
    void check();
    const timer = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>AvatarStudio</h1>
      <p>Этап 0 — скелет монорепо. Редактор появится на Этапе 6.</p>
      <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: colors[state],
            display: 'inline-block',
          }}
        />
        <strong>{healthLabel(state)}</strong>
        {state === 'ok' && uptime !== null && <span>(uptime {uptime}s)</span>}
      </p>
    </main>
  );
}
