// Replaces aws-amplify/auth so tests don't need real Cognito credentials.
// fetchAuthSession is called by PhotosPage, WhatsAppPage, and App (to detect
// the "demo" Cognito group) to get an idToken for the Authorization header.
module.exports = {
  fetchAuthSession: jest.fn().mockResolvedValue({
    tokens: {
      idToken: {
        toString: () => 'mock-id-token',
        payload: { 'cognito:groups': [] },
      },
    },
  }),
};
