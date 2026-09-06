import express from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityMiddleware } from './middleware/security.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import authRoutes from './routes/authRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import procurementRoutes from './routes/procurementRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
app.disable('x-powered-by');
app.use(...securityMiddleware);
app.use(pinoHttp());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/health', (request, response) => response.json({ success: true, data: { status: 'ok', service: 'krishi-nova-backend' } }));
app.use('/api/auth', authRoutes);
app.use('/api', resourceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/procurements', procurementRoutes);
app.use('/api/admin', adminRoutes);
try {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const specification = YAML.parse(fs.readFileSync(path.join(currentDir, '../docs/openapi.yaml'), 'utf8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specification));
} catch (error) { console.warn('OpenAPI documentation unavailable:', error.message); }
app.use(notFoundHandler);
app.use(errorHandler);
export default app;
