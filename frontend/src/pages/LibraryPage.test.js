import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LibraryPage, { getPrefix } from './LibraryPage';

// Mock uploadData so file selection doesn't attempt real S3 uploads.
jest.mock('aws-amplify/storage', () => ({
  uploadData: jest.fn(),
}));

// LibraryPage uses <Link>, which requires a Router context.
function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// getPrefix is a pure function — no mocks needed, just inputs and expected outputs.
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
  ])('routes %s → %s', (filename, expected) => {
    expect(getPrefix(filename)).toBe(expected);
  });
});

test('renders a file upload input', () => {
  const { container } = renderWithRouter(<LibraryPage />);
  expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
});

test('renders all four section links', () => {
  renderWithRouter(<LibraryPage />);
  expect(screen.getByText('Photos')).toBeInTheDocument();
  expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  expect(screen.getByText('Other Files')).toBeInTheDocument();
  expect(screen.getByText('Videos')).toBeInTheDocument();
});

test('Photos link points to /library/photos', () => {
  renderWithRouter(<LibraryPage />);
  expect(screen.getByText('Photos').closest('a')).toHaveAttribute('href', '/library/photos');
});

test('WhatsApp link points to /library/whatsapp', () => {
  renderWithRouter(<LibraryPage />);
  expect(screen.getByText('WhatsApp').closest('a')).toHaveAttribute('href', '/library/whatsapp');
});

test('Other Files link points to /library/files', () => {
  renderWithRouter(<LibraryPage />);
  expect(screen.getByText('Other Files').closest('a')).toHaveAttribute('href', '/library/files');
});
