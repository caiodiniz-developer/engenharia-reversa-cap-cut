import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { Icon, type IconName } from '../components/Icon';
import { useAuth } from '../store/auth';

export function LoginPage() {
  const status = useAuth((s) => s.status);
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const [params] = useSearchParams();
  // /login?modo=cadastro (vindo da landing) já abre na aba de criar conta
  const [mode, setMode] = useState<'login' | 'register'>(params.get('modo') === 'cadastro' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const location = useLocation();

  if (status === 'authenticated') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation') {
        const first = (err.details as Array<{ path: string; message: string }> | undefined)?.[0];
        setError(first ? `${fieldName(first.path)}: ${first.message}` : err.message);
      } else setError(err instanceof Error ? err.message : 'Não foi possível entrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid h-full overflow-auto lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="stage-bg relative hidden flex-col justify-between overflow-hidden border-r border-line p-10 lg:flex" aria-hidden="true">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <Icon name="play" size={18} />
          </span>
          <span className="text-lg font-semibold">Editor de Vídeo</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Edite, legende e exporte vídeos direto no navegador.</h2>
          <ul className="mt-6 grid max-w-md gap-3 text-sm text-mute">
            {[
              ['film', 'Timeline multifaixa com efeitos, transições e animações'],
              ['captions', 'Legendas automáticas e estilos de texto'],
              ['sparkles', 'Prévia e exportação com o mesmo resultado'],
              ['cloud', 'Salvamento automático e recuperação offline'],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-3 text-accent">
                  <Icon name={icon as IconName} size={15} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-2xs text-mute">Projeto independente · exportação feita no servidor com FFmpeg</p>
      </aside>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-mute hover:text-ink" data-testid="back-home">
            <Icon name="chevronRight" size={13} style={{ transform: 'rotate(180deg)' }} /> Voltar ao início
          </Link>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink">
              <Icon name="play" size={18} />
            </span>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Editor de Vídeo</h1>
              <p className="text-xs text-mute">Edite, legende e exporte direto no navegador.</p>
            </div>
          </div>
          <h1 className="mb-1 hidden text-xl font-semibold lg:block">{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h1>
          <p className="mb-5 hidden text-sm text-mute lg:block">{mode === 'login' ? 'Entre para continuar seus projetos.' : 'Leva menos de um minuto.'}</p>

          <div className="card p-5">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-panel-2 p-1" role="tablist">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  type="button"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`rounded-md py-1.5 text-xs font-medium transition-colors ${mode === m ? 'bg-panel-3 text-ink shadow-sm' : 'text-mute hover:text-ink'}`}
                >
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} noValidate>
              {mode === 'register' && (
                <div className="mb-3">
                  <label className="label" htmlFor="name">
                    Nome
                  </label>
                  <input id="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="mb-3">
                <label className="label" htmlFor="email">
                  E-mail
                </label>
                <input id="email" type="email" className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="mb-4">
                <label className="label" htmlFor="password">
                  Senha
                </label>
                <input id="password" type="password" className="field" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                {mode === 'register' && <p className="mt-1 text-2xs text-mute">Mínimo de 8 caracteres.</p>}
              </div>
              {error && (
                <p role="alert" className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-primary h-9 w-full" disabled={busy}>
                {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function fieldName(path: string): string {
  return { email: 'E-mail', password: 'Senha', name: 'Nome' }[path] ?? path;
}
