import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { useAuth } from './store/auth.js';
import { LoginPage } from './pages/LoginPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { EditorPage } from './pages/EditorPage.js';
import './styles.css';

function Root() {
  const { init, loading } = useAuth();
  useEffect(() => {
    void init();
  }, [init]);
  if (loading) return <p style={{ padding: 32 }}>Загрузка…</p>;
  return <Outlet />;
}

function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <ProjectsPage /> },
          { path: '/projects/:projectId/edit', element: <EditorPage /> },
        ],
      },
    ],
  },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');
createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
