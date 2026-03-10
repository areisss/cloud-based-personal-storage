import { render, screen } from '@testing-library/react';
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
// Mock it so tests don't attempt real S3 uploads.
jest.mock('aws-amplify/storage', () => ({
  uploadData: jest.fn(),
}));

test('renders the landing page at /', () => {
  render(<App />);
  expect(screen.getByText('Your Personal Cloud')).toBeInTheDocument();
});

test('shows a Sign in link on the public landing page', () => {
  render(<App />);
  const signInLinks = screen.getAllByText(/sign in to your storage/i);
  expect(signInLinks.length).toBeGreaterThan(0);
});
