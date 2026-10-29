import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toasts } from './components/Toasts';
import { LandingPage } from './pages/landing/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { useAuth } from './store/auth';

// O editor é pesado (timeline, preview, painéis): carrega sob demanda.
const EditorPage = lazy(() => import('./pages/EditorPage').then((m) => ({ default: m.EditorPage })));

function Protected({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'anonymous') return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

/** "/" mostra os projetos para quem entrou e a landing page para quem ainda não entrou. */
function Home() {
  const status = useAuth((s) => s.status);
  if (status === 'loading') return <Splash />;
  return status === 'authenticated' ? <ProjectsPage /> : <LandingPage />;
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-mute" role="status">
      Carregando…
    </div>
  );
}

export function App() {
  const restore = useAuth((s) => s.restore);
  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <BrowserRouter>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Home />} />
          <Route path="/p/:id" element={<Protected><EditorPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toasts />
    </BrowserRouter>
  );
}
