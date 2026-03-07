import { useEffect, useState } from 'react';
import { list, getUrl } from 'aws-amplify/storage';

// The two S3 prefixes we want to browse.
const PREFIXES = ['misc/', 'uploads-landing/'];

function OtherFilesPage() {
  // files is an object keyed by prefix, each holding an array of {key, url} items.
  // e.g. { 'misc/': [{key: 'misc/file.txt', url: '...'}], 'uploads-landing/': [...] }
  const [files, setFiles]   = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function fetchFiles() {
      try {
        const result = {};

        for (const prefix of PREFIXES) {
          // list() calls S3 ListObjectsV2 under the hood via Amplify.
          // It returns all objects under the given prefix.
          const { items } = await list({ prefix });

          // For each item, generate a presigned URL so the user can download it.
          // getUrl() is the Amplify equivalent of s3.generate_presigned_url.
          const withUrls = await Promise.all(
            items.map(async item => {
              const { url } = await getUrl({ path: item.path });
              return { key: item.path, url: url.toString() };
            })
          );

          result[prefix] = withUrls;
        }

        setFiles(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFiles();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error)   return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Other Files</h1>
      {PREFIXES.map(prefix => (
        <div key={prefix}>
          <h2>{prefix}</h2>
          {files[prefix]?.length === 0 && <p>No files.</p>}
          <ul>
            {files[prefix]?.map(file => (
              // Show just the filename, not the full S3 key path
              <li key={file.key}>
                <a href={file.url} target="_blank" rel="noreferrer">
                  {file.key.replace(prefix, '')}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default OtherFilesPage;
