import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

export default function Nav({ signOut, user }) {
  const { pathname } = useLocation();
  const { dark, toggle, t } = useTheme();
  const isAuthed = Boolean(user);

  const navLink = (to, label) => (
    <Link
      to={to}
      style={{
        color: pathname === to ? t.navText : t.navMuted,
        background: pathname === to ? t.navActive : 'transparent',
        padding: '6px 14px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  );

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: '60px', background: t.navBg,
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: '4px', zIndex: 100,
      borderBottom: `1px solid ${t.navBorder}`,
    }}>
      <Link to="/" style={{
        color: t.navText, fontWeight: 700, fontSize: '17px',
        textDecoration: 'none', marginRight: '20px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        ☁ My Cloud
      </Link>

      {isAuthed && navLink('/library', 'Library')}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={toggle}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            color: t.navMuted,
            width: '32px', height: '32px',
            borderRadius: '6px',
            fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {dark ? '☀' : '🌙'}
        </button>

        {isAuthed ? (
          <>
            {user?.username && (
              <span style={{ color: t.navMuted, fontSize: '13px' }}>{user.username}</span>
            )}
            <button
              onClick={signOut}
              style={{
                background: 'transparent', border: '1px solid #334155',
                color: t.navMuted, padding: '5px 14px', borderRadius: '6px',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            to="/library"
            style={{
              background: t.accent, color: '#fff',
              padding: '5px 16px', borderRadius: '6px',
              fontSize: '13px', fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
