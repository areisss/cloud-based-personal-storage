import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LibraryPage from './LibraryPage';

// LibraryPage uses <Link>, which requires a Router context.
// MemoryRouter provides that context without touching window.location.
function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

test('renders all three section links', () => {
  renderWithRouter(<LibraryPage />);
  expect(screen.getByText('Photos')).toBeInTheDocument();
  expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  expect(screen.getByText('Other Files')).toBeInTheDocument();
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
