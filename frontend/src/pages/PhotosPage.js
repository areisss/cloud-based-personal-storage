import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = process.env.REACT_APP_PHOTOS_API_URL;

function PhotosPage() {
  // photos holds the array returned by the API.
  // loading/error drive what the UI renders.
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // useEffect with an empty dependency array runs once when the component mounts —
    // equivalent to "fetch data when the page loads".
    async function fetchPhotos() {
      try {
        // fetchAuthSession returns the current Cognito session.
        // idToken is what API Gateway's Cognito authorizer validates.
        // We use idToken (not accessToken) because that's what API Gateway expects
        // when the authorizer type is COGNITO_USER_POOLS.
        const session = await fetchAuthSession();
        const idToken = session.tokens.idToken.toString();

        const response = await fetch(API_URL, {
          headers: { Authorization: idToken },
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        setPhotos(data);
      } catch (err) {
        setError(err.message);
      } finally {
        // finally runs whether the fetch succeeded or failed —
        // always stop showing the loading state.
        setLoading(false);
      }
    }

    fetchPhotos();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error)   return <p>Error: {error}</p>;
  if (photos.length === 0) return <p>No photos yet.</p>;

  return (
    <div>
      <h1>Photos</h1>
      {/* Simple grid: each photo shows its thumbnail and a download link */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {photos.map(photo => (
          <div key={photo.photo_id}>
            <img
              src={photo.thumbnail_url}
              alt={photo.filename}
              style={{ width: '150px', height: '150px', objectFit: 'cover' }}
            />
            <div>
              <a href={photo.original_url} download={photo.filename}>
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PhotosPage;
