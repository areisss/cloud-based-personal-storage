import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

test('renders the hero headline', () => {
  renderWithRouter(<HomePage />);
  expect(screen.getByText('Your Personal Cloud')).toBeInTheDocument();
});

test('renders a Sign in link pointing to /library', () => {
  renderWithRouter(<HomePage />);
  const links = screen.getAllByRole('link', { name: /sign in to your storage/i });
  expect(links.length).toBeGreaterThan(0);
  expect(links[0]).toHaveAttribute('href', '/library');
});

test('renders all four feature cards', () => {
  renderWithRouter(<HomePage />);
  expect(screen.getByText('Photos')).toBeInTheDocument();
  expect(screen.getByText('Videos')).toBeInTheDocument();
  expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  expect(screen.getByText('Other Files')).toBeInTheDocument();
});
