import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEMPLATE_CATEGORY_LABELS, type TemplateCategory } from '@avatarstudio/shared';
import { api } from '../api/client.js';

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  isStock: boolean;
  placeholders: string[];
  scenes: number;
}

export function TemplatesGrid({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [active, setActive] = useState<TemplateItem | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<TemplateItem[]>('GET', `/api/workspaces/${workspaceId}/templates`).then(setItems);
  }, [workspaceId]);

  async function instantiate(e: FormEvent) {
    e.preventDefault();
    if (!active) return;
    setError(null);
    try {
      const res = await api<{ projectId: string }>(
        'POST',
        `/api/workspaces/${workspaceId}/templates/${active.id}/instantiate`,
        { variables: values },
      );
      navigate(`/projects/${res.projectId}/edit`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h2 style={{ fontSize: 17, marginTop: 32 }}>Шаблоны</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {items.map((t) => (
          <div
            key={t.id}
            className="project-card"
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, margin: 0 }}
            data-testid="template-card"
            onClick={() => {
              setActive(t);
              setValues(Object.fromEntries(t.placeholders.map((p) => [p, ''])));
            }}
          >
            <span className="muted" style={{ fontSize: 11 }}>
              {TEMPLATE_CATEGORY_LABELS[t.category as TemplateCategory] ?? t.category}
              {!t.isStock && ' · мой'}
            </span>
            <strong>{t.name}</strong>
            <span className="muted">{t.description ?? ''}</span>
            <span className="muted">{t.scenes} сцен · {t.placeholders.length} переменных</span>
          </div>
        ))}
      </div>

      {active && (
        <div className="render-overlay" onClick={() => setActive(null)}>
          <form className="render-dialog" onClick={(e) => e.stopPropagation()} onSubmit={instantiate}>
            <strong>{active.name}</strong>
            {active.placeholders.map((p) => (
              <label key={p} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                {`{{${p}}}`}
                <input
                  required
                  value={values[p] ?? ''}
                  data-testid={`var-${p}`}
                  onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
                />
              </label>
            ))}
            {error && <p className="error-text">{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" data-testid="instantiate-template">Создать проект</button>
              <button type="button" className="ghost" onClick={() => setActive(null)}>Отмена</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
