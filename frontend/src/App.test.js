import { render, screen } from '@testing-library/react';
import App from './App';

// Authenticator normally shows a Cognito sign-in form and blocks rendering
// until the user authenticates. We replace it with a pass-through that
// immediately calls children with a fake user, so we can test app routes.
jest.mock('@aws-amplify/ui-react', () => ({
  Authenticator: ({ children }) =>
    children({ signOut: jest.fn(), user: { username: 'testuser' } }),
}));

// The Authenticator stylesheet import throws in jsdom. Redirect it to the
// empty CSS mock defined in src/__mocks__/styleMock.js.
jest.mock('@aws-amplify/ui-react/styles.css', () => {});

// uploadData is called when the user selects a file in HomePage.
// Mock it so tests don't attempt real S3 uploads.
jest.mock('aws-amplify/storage', () => ({
  uploadData: jest.fn(),
}));

test('renders the home page at /', () => {
  render(<App />);
  expect(screen.getByText('Home')).toBeInTheDocument();
});

test('shows a file upload input on the home page', () => {
  const { container } = render(<App />);
  expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
});
