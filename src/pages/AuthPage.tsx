import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api/client';
import { useAuthActions, useMe } from '../auth';
import { LogoMark } from '../components/ui';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { me } = useMe();
  const { login, register } = useAuthActions();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const mutation = mode === 'login' ? login : register;

  if (me) return <Navigate to={from} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const done = { onSuccess: () => navigate(mode === 'register' ? '/zoos' : from, { replace: true }) };
    if (mode === 'login') login.mutate({ username, password }, done);
    else register.mutate({ username, password, displayName: displayName || undefined }, done);
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card card" onSubmit={submit}>
        <LogoMark className="auth-logo" />
        <h1>{mode === 'login' ? 'Welcome back' : 'Start your zoo'}</h1>
        <p className="muted">
          {mode === 'login' ? 'Log in to keep planning and see what your friends built.' : 'Create an account to plan, publish and share your zoos.'}
        </p>
        {mutation.error && <div className="form-error">{errorMessage(mutation.error)}</div>}
        <label className="field">
          <span>Username</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
            minLength={mode === 'register' ? 3 : 1}
            maxLength={24}
            pattern={mode === 'register' ? '[A-Za-z0-9_]+' : undefined}
            title={mode === 'register' ? 'Letters, numbers and _ only' : undefined}
          />
          {mode === 'register' && <small>Letters, numbers and _ — this is your @handle.</small>}
        </label>
        {mode === 'register' && (
          <label className="field">
            <span>Display name</span>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="Optional" />
          </label>
        )}
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : 1}
          />
          {mode === 'register' && <small>At least 8 characters.</small>}
        </label>
        <button className="btn btn-primary btn-lg btn-block" disabled={mutation.isPending}>
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <p className="subtle" style={{ textAlign: 'center' }}>
          {mode === 'login' ? (
            <>
              New here? <Link to="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
