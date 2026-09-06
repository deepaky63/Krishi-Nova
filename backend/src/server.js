import http from 'node:http';
import app from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { attachSockets } from './sockets/index.js';

const server = http.createServer(app);
attachSockets(server);

if (process.env.NODE_ENV !== 'test') {
  connectDatabase().then(() => server.listen(env.port, () => console.log(`Krishi Nova backend listening on ${env.port}`))).catch((error) => { console.error('Database connection failed:', error.message); process.exit(1); });
}

export { server };
