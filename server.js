const app = require('./app');
const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/db');

async function start() {
  await connectDatabase();
  console.log('Connected to MongoDB.');
  const server = app.listen(env.port, () => {
    console.log(`Saffron & Stone listening at http://localhost:${env.port}`);
  });

  async function shutdown() {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Unable to start application:', error.message);
  process.exit(1);
});
