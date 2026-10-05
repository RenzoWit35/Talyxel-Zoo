import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'talyxel.theme';

const systemTheme = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  return set === 'light' || set === 'dark' ? set : systemTheme();
}

/** Light/dark theme. Until someone picks one, the site follows the system setting (see public/theme.js). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  // Keep following the system while nothing has been picked.
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => !document.documentElement.dataset.theme && setTheme(systemTheme());
    media?.addEventListener('change', onChange);
    return () => media?.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* not remembered, but still applied */
    }
    setTheme(next);
  };

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return { theme, toggle, label, Icon: theme === 'dark' ? Sun : Moon };
}

/** Round light/dark switch for the logged-out header (signed-in builders find it in the avatar menu). */
export function ThemeToggle() {
  const { toggle, label, Icon } = useTheme();
  return (
    <button className="btn btn-icon theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <Icon />
    </button>
  );
}
