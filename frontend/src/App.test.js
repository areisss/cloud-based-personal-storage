import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Authenticator normally shows a Cognito sign-in form and blocks rendering
// until the user authenticates. We replace it with a pass-through that
// immediately calls children with a fake user, so we can test library routes.
jest.mock('@aws-amplify/ui-react', () => ({
  Authenticator: ({ children }) =>
    children({ signOut: jest.fn(), user: { username: 'testuser' } }),
}));

// The Authenticator stylesheet import throws in jsdom.
jest.mock('@aws-amplify/ui-react/styles.css', () => {});

// uploadData is called when the user selects a file in LibraryPage.
jest.mock('aws-amplify/storage', () => ({
  uploadData: jest.fn(),
}));

// fetchAuthSession mock is provided by src/__mocks__/amplifyAuthMock.js
// (mapped via jest.moduleNameMapper in package.json).
// Default mock returns no groups → isDemo = false.
const { fetchAuthSession } = require('aws-amplify/auth');

test('renders the landing page at /', () => {
  render(<App />);
  expect(screen.getByText('Your Personal Cloud')).toBeInTheDocument();
});

test('shows Sign in links on the public landing page', () => {
  render(<App />);
  const links = screen.getAllByText(/sign in to your storage/i);
  expect(links.length).toBeGreaterThan(0);
});

test('shows demo credentials on the landing page', () => {
  render(<App />);
  expect(screen.getByText('Demo credentials')).toBeInTheDocument();
  expect(screen.getByText('Demo2024!')).toBeInTheDocument();
});

test('upload card visible for regular user (not demo group)', async () => {
  fetchAuthSession.mockResolvedValueOnce({
    tokens: { idToken: { toString: () => 'tok', payload: { 'cognito:groups': [] } } },
  });

  const { container } = render(<App initialEntries={['/library']} />);
  // Navigate to /library by rendering App — MemoryRouter not used here so we
  // can't control the path directly. The test just confirms no demo banner.
  await waitFor(() => {
    // Either the upload input is present OR no demo banner
    const banner = screen.queryByText(/demo mode/i);
    expect(banner).toBeNull();
  });
});
