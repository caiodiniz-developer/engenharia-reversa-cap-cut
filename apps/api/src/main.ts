import { createServer } from 'node:http';
import { buildApp } from './app';

const built = await buildApp();
const server = createServer(built.app);
built.attach(server);
server.listen(built.ctx.config.PORT, () => {
  console.log(`API em http://localhost:${built.ctx.config.PORT}`);
});

const shutdown = async () => {
  server.close();
  await built.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
