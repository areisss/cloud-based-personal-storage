import { render } from '@testing-library/react';
import HomePage, { getPrefix } from './HomePage';

// Mock uploadData so file selection doesn't attempt real S3 uploads.
jest.mock('aws-amplify/storage', () => ({
  uploadData: jest.fn(),
}));

// getPrefix is a pure function — no mocks needed, just inputs and expected outputs.
// test.each runs the same assertion for every row in the table.
describe('getPrefix', () => {
  test.each([
    // Images → raw-photos/ (all supported extensions)
    ['photo.jpg',  'raw-photos/'],
    ['photo.jpeg', 'raw-photos/'],
    ['photo.png',  'raw-photos/'],
    ['photo.webp', 'raw-photos/'],
    // Extension matching is case-insensitive
    ['PHOTO.JPG',  'raw-photos/'],
    // Zip archives → uploads-landing/ (processed by a separate pipeline)
    ['backup.zip', 'uploads-landing/'],
    // WhatsApp text exports → raw-whatsapp-uploads/
    ['chat.txt',   'raw-whatsapp-uploads/'],
    // Everything else → misc/
    ['report.pdf', 'misc/'],
    ['data.xlsx',  'misc/'],
    ['video.mp4',  'misc/'],
  ])('routes %s → %s', (filename, expected) => {
    expect(getPrefix(filename)).toBe(expected);
  });
});

test('renders a file upload input', () => {
  const { container } = render(<HomePage />);
  expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
});
