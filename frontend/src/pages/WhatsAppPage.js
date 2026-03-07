import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';

const API_URL = process.env.REACT_APP_CHATS_API_URL;

// Give each sender a consistent colour so messages are easy to skim.
const COLOURS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
function senderColour(sender) {
  let h = 0;
  for (const c of sender) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLOURS[Math.abs(h) % COLOURS.length];
}

const inputStyle = {
  padding: '8px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '14px',
  background: '#fff',
  color: '#0f172a',
  outline: 'none',
};

function WhatsAppPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [date, setDate]         = useState('');
  const [sender, setSender]     = useState('');
  const [search, setSearch]     = useState('');

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

  // Fetch on first load with no filters.
  // fetchMessages is intentionally omitted from deps — subsequent calls are
  // triggered by the Search button, not by filter state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMessages(); }, []);

  function clearFilters() {
    setDate('');
    setSender('');
    setSearch('');
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      <Link to="/library" style={{ color: '#6366f1', fontSize: '14px', fontWeight: '500' }}>
        ← Back to Library
      </Link>
      <h1 style={{ margin: '16px 0 24px', fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>
        WhatsApp Messages
      </h1>

      {/* Filter bar */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0',
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
            background: '#6366f1', color: '#fff',
            border: 'none', padding: '8px 20px', borderRadius: '8px',
            fontWeight: '600', fontSize: '14px',
          }}
        >
          Search
        </button>
        <button
          onClick={clearFilters}
          style={{
            background: '#f1f5f9', color: '#475569',
            border: 'none', padding: '8px 16px', borderRadius: '8px',
            fontWeight: '500', fontSize: '14px',
          }}
        >
          Clear
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: '15px' }}>
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
          <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: '#475569' }}>
            No messages found
          </p>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            Upload a WhatsApp .txt export from the home page.
          </p>
        </div>
      )}

      {!loading && messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              padding: '12px 16px',
              background: '#fff',
              border: '1px solid #f1f5f9',
              borderRadius: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '5px' }}>
                <span style={{ color: senderColour(msg.sender), fontWeight: '700', fontSize: '13px' }}>
                  {msg.sender}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                  {msg.date} {msg.time}
                </span>
              </div>
              <p style={{ margin: 0, color: '#334155', fontSize: '14px', lineHeight: '1.55' }}>
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
