import { OAuth2Client } from 'google-auth-library';

let client;

const getClient = () => {
  if (!client) client = new OAuth2Client();
  return client;
};

export const verifyGoogleIdToken = async (idToken) => {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    throw new Error('GOOGLE_CLIENT_ID is not set');
  }
  const ticket = await getClient().verifyIdToken({
    idToken,
    audience,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) {
    throw new Error('Invalid Google token');
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture,
    emailVerified: payload.email_verified ?? false,
  };
};
