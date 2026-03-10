import { Link, useLocation } from 'react-router-dom';

export default function Nav({ signOut, user }) {
  const { pathname } = useLocation();
  const isAuthed = Boolean(user);

  const navLink = (to, label) => (
    <Link
      to={to}
      style={{
        color: pathname === to ? '#ffffff' : '#94a3b8',
        background: pathname === to ? 'rgba(255,255,255,0.1)' : 'transparent',
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
      height: '60px', background: '#0f172a',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: '4px', zIndex: 100,
      borderBottom: '1px solid #1e293b',
    }}>
      <Link to="/" style={{
        color: '#f8fafc', fontWeight: 700, fontSize: '17px',
        textDecoration: 'none', marginRight: '20px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        ☁ My Cloud
      </Link>

      {isAuthed && navLink('/library', 'Library')}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isAuthed ? (
          <>
            {user?.username && (
              <span style={{ color: '#64748b', fontSize: '13px' }}>{user.username}</span>
            )}
            <button
              onClick={signOut}
              style={{
                background: 'transparent', border: '1px solid #334155',
                color: '#94a3b8', padding: '5px 14px', borderRadius: '6px',
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
              background: '#6366f1', color: '#fff',
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
