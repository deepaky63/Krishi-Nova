import 'dotenv/config';

const required = (name) => {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const csv = (value, fallback = []) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : fallback);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: required('MONGODB_URI'),
  mongoDbName: process.env.MONGODB_DB_NAME || 'krishi_nova',
  accessSecret: required('JWT_ACCESS_SECRET') || 'development-access-secret',
  refreshSecret: required('JWT_REFRESH_SECRET') || 'development-refresh-secret',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bootstrapSecret: process.env.BOOTSTRAP_SECRET,
  frontendOrigins: csv(process.env.FRONTEND_ORIGINS, ['http://localhost:5173']),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  serviceMinutes: Number(process.env.DEFAULT_SERVICE_TIME_MINUTES || 10),
  bookingCutoffMinutes: Number(process.env.DEFAULT_BOOKING_CUTOFF_MINUTES || 60),
  noShowGraceMinutes: Number(process.env.DEFAULT_NO_SHOW_GRACE_MINUTES || 30),
  whatsappEnabled: process.env.WHATSAPP_ENABLED === 'true',
  whatsappApiUrl: process.env.WHATSAPP_API_URL,
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
};
