import { Link } from 'react-router-dom';

function LibraryPage() {
  return (
    <div>
      <h1>Library</h1>
      <Link to="/library/photos">Photos</Link>
      <br />
      <Link to="/library/whatsapp">WhatsApp</Link>
      <br />
      <Link to="/library/files">Other Files</Link>
    </div>
  );
}

export default LibraryPage;
