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
  expect(screen.getByRole('heading', { name: 'Photos' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Videos' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'WhatsApp' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Other Files' })).toBeInTheDocument();
});

test('renders data pipeline section', () => {
  renderWithRouter(<HomePage />);
  expect(screen.getByRole('heading', { name: 'WhatsApp data pipeline' })).toBeInTheDocument();
  expect(screen.getByText('Bronze')).toBeInTheDocument();
  expect(screen.getByText('Silver')).toBeInTheDocument();
  expect(screen.getByText('Gold')).toBeInTheDocument();
});

test('renders AWS Glue and Athena callouts', () => {
  renderWithRouter(<HomePage />);
  expect(screen.getByText('AWS Glue Python Shell')).toBeInTheDocument();
  expect(screen.getByText('Amazon Athena')).toBeInTheDocument();
});
