import { uploadData } from 'aws-amplify/storage';

export function getPrefix(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'zip') return 'uploads-landing/';
    if (ext === 'txt') return 'raw-whatsapp-uploads/';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'raw-photos/';
    return 'misc/';
}

async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const prefix = getPrefix(file.name);
    await uploadData({ path: prefix + file.name, data: file });
}

function HomePage() {
    return (
        <div>
            <h1>Home</h1>
            <input type="file" onChange={handleUpload} />
        </div>
    );
}

export default HomePage;