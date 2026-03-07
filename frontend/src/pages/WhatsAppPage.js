import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = process.env.REACT_APP_CHATS_API_URL;

function WhatsAppPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // Filter state — each maps directly to a query param the API accepts.
  // They start empty, meaning "no filter applied".
  const [date, setDate]     = useState('');
  const [sender, setSender] = useState('');
  const [search, setSearch] = useState('');

  async function fetchMessages() {
    setLoading(true);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens.idToken.toString();

      // Build query string from whichever filters have values.
      // URLSearchParams handles encoding special characters automatically.
      const params = new URLSearchParams();
      if (date)   params.append('date', date);
      if (sender) params.append('sender', sender);
      if (search) params.append('search', search);

      const url = params.toString() ? `${API_URL}?${params}` : API_URL;

      const response = await fetch(url, {
        headers: { Authorization: idToken },
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      setMessages(data);
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

  return (
    <div>
      <h1>WhatsApp Messages</h1>

      {/* Filter controls — user fills these in and clicks Search */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          placeholder="Date"
        />
        <input
          type="text"
          value={sender}
          onChange={e => setSender(e.target.value)}
          placeholder="Sender"
        />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search messages"
        />
        {/* Clicking Search triggers a new API call with current filter values */}
        <button onClick={fetchMessages}>Search</button>
        <button onClick={() => {
          // Clear all filters and re-fetch everything
          setDate('');
          setSender('');
          setSearch('');
        }}>Clear</button>
      </div>

      {loading && <p>Loading...</p>}
      {error   && <p>Error: {error}</p>}

      {!loading && !error && messages.length === 0 && (
        <p>No messages found.</p>
      )}

      {/* Message list — each row shows date, time, sender, message */}
      {!loading && messages.map((msg, i) => (
        <div key={i} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
          <small>{msg.date} {msg.time} — <strong>{msg.sender}</strong></small>
          <p style={{ margin: '4px 0' }}>{msg.message}</p>
        </div>
      ))}
    </div>
  );
}

export default WhatsAppPage;
