import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const API_URL = process.env.REACT_APP_CHATS_API_URL;

const COLOURS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
function senderColour(sender) {
  let h = 0;
  for (const c of sender) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLOURS[Math.abs(h) % COLOURS.length];
}

function WhatsAppPage() {
  const { t } = useTheme();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [date, setDate]         = useState('');
  const [sender, setSender]     = useState('');
  const [search, setSearch]     = useState('');

  const inputStyle = {
    padding: '8px 12px',
    border: `1px solid ${t.inputBorder}`,
    borderRadius: '8px',
    fontSize: '14px',
    background: t.inputBg,
    color: t.inputText,
    outline: 'none',
  };

  async function fetchMessages() {
    setLoading(true);
    setError(null);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens.idToken.toString();
      const params = new URLSearchParams();
      if (date)   params.append('date', date);
      if (sender) params.append('sender', sender);
      if (search) params.append('search', search);
      const url = params.toString() ? `${API_URL}?${params}` : API_URL;
      const response = await fetch(url, { headers: { Authorization: idToken } });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      setMessages(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMessages(); }, []);

  function clearFilters() {
    setDate('');
    setSender('');
    setSearch('');
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      <Link to="/library" style={{ color: t.accent, fontSize: '14px', fontWeight: '500' }}>
        ← Back to Library
      </Link>
      <h1 style={{ margin: '16px 0 24px', fontSize: '28px', fontWeight: '800', color: t.text }}>
        WhatsApp Messages
      </h1>

      <div style={{
        background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: '12px', padding: '16px',
        display: 'flex', flexWrap: 'wrap', gap: '10px',
        alignItems: 'center', marginBottom: '24px',
      }}>
        <input
          type="date" value={date}
          onChange={e => setDate(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text" value={sender} placeholder="Sender"
          onChange={e => setSender(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '120px' }}
        />
        <input
          type="text" value={search} placeholder="Search messages"
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 2, minWidth: '160px' }}
        />
        <button
          onClick={fetchMessages}
          style={{
            background: t.accent, color: '#fff',
            border: 'none', padding: '8px 20px', borderRadius: '8px',
            fontWeight: '600', fontSize: '14px',
          }}
        >
          Search
        </button>
        <button
          onClick={clearFilters}
          style={{
            background: t.clearBtnBg, color: t.clearBtnText,
            border: 'none', padding: '8px 16px', borderRadius: '8px',
            fontWeight: '500', fontSize: '14px',
          }}
        >
          Clear
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: t.subtle, fontSize: '15px' }}>
          Loading messages…
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#ef4444', fontSize: '15px' }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>💬</div>
          <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: t.muted }}>
            No messages found
          </p>
          <p style={{ margin: 0, color: t.subtle, fontSize: '14px' }}>
            Upload a WhatsApp .txt export from the home page.
          </p>
        </div>
      )}

      {!loading && messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              padding: '12px 16px',
              background: t.surface,
              border: `1px solid ${t.border2}`,
              borderRadius: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '5px' }}>
                <span style={{ color: senderColour(msg.sender), fontWeight: '700', fontSize: '13px' }}>
                  {msg.sender}
                </span>
                <span style={{ color: t.subtle, fontSize: '12px' }}>
                  {msg.date} {msg.time}
                </span>
              </div>
              <p style={{ margin: 0, color: t.text, fontSize: '14px', lineHeight: '1.55' }}>
                {msg.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WhatsAppPage;
