import dotenv from 'dotenv';
dotenv.config();

// Fail fast on missing config instead of cryptic runtime errors.
// Dev and prod MUST use different databases (see MONGO_DB_NAME below).
const requiredInProduction = ['MONGO_URI', 'REDIS_URL'];
if (process.env.NODE_ENV === 'production') {
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars in production: ${missing.join(', ')}`);
  }
  if (!process.env.API_KEY) {
    throw new Error('API_KEY must be set in production (write endpoints).');
  }
  const authRequired = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missingAuth = authRequired.filter((key) => !process.env[key]);
  if (missingAuth.length > 0) {
    throw new Error(
      `Missing required auth env vars in production: ${missingAuth.join(', ')}`
    );
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID must be set in production (Google login).');
  }
  const smtpRequired = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missingSmtp = smtpRequired.filter((key) => !process.env[key]);
  if (missingSmtp.length > 0) {
    throw new Error(
      `Missing required SMTP env vars in production: ${missingSmtp.join(', ')}`
    );
  }
  const dbName = (process.env.MONGO_DB_NAME || '').toLowerCase();
  if (
    !dbName ||
    dbName.includes('dev') ||
    dbName.includes('test') ||
    dbName.includes('localhost')
  ) {
    throw new Error(
      'MONGO_DB_NAME must be set to a production database (e.g. reerhub-prod), never dev/test.'
    );
  }
}

// Safety: never let tests run against dev/prod data.
if (process.env.NODE_ENV === 'test' && !process.env.MONGO_DB_NAME) {
  process.env.MONGO_DB_NAME = 'reerhub-test';
}
