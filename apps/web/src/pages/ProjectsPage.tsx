import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import type { Project } from '../api/types.js';
import { useAuth } from '../store/auth.js';

export function ProjectsPage() {
  const { user, workspace, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    void api<Project[]>('GET', `/api/workspaces/${workspace.id}/projects`).then(setProjects);
  }, [workspace]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    setError(null);
    try {
      const project = await api<Project>('POST', `/api/workspaces/${workspace.id}/projects`, {
        title: title || 'Новый проект',
      });
      navigate(`/projects/${project.id}/edit`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="projects-page">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, marginRight: 'auto' }}>Проекты</h1>
        <span className="muted" style={{ marginRight: 12 }}>{user?.email}</span>
        <button className="ghost" onClick={() => { logout(); navigate('/login'); }}>
          Выйти
        </button>
      </div>

      <form onSubmit={createProject} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          placeholder="Название нового проекта"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1 }}
          data-testid="new-project-title"
        />
        <button type="submit" data-testid="create-project">Создать проект</button>
      </form>
      {error && <p className="error-text">{error}</p>}

      {projects.map((p) => (
        <div
          key={p.id}
          className="project-card"
          data-testid="project-card"
          onClick={() => navigate(`/projects/${p.id}/edit`)}
        >
          <div>
            <strong>{p.title}</strong>
            <div className="muted">{p.aspectRatio} · {p.defaultLanguage}</div>
          </div>
          <span className="muted">открыть →</span>
        </div>
      ))}
      {!projects.length && <p className="muted">Пока нет проектов — создайте первый.</p>}
    </div>
  );
}
