import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await register(email, password, name);
      else await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h1 style={{ margin: 0, fontSize: 22 }}>AvatarStudio</h1>
      <p className="muted">{mode === 'register' ? 'Создайте аккаунт' : 'Войдите в аккаунт'}</p>
      {mode === 'register' && (
        <input
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          data-testid="name-input"
        />
      )}
      <input
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        data-testid="email-input"
      />
      <input
        type="password"
        placeholder="Пароль (мин. 8 символов)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        data-testid="password-input"
      />
      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={busy} data-testid="auth-submit">
        {mode === 'register' ? 'Зарегистрироваться' : 'Войти'}
      </button>
      <button
        type="button"
        className="ghost"
        data-testid="auth-toggle"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
      </button>
    </form>
  );
}
