import dotenv from 'dotenv';
import { createApp, createDefaultState } from './app';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);

const state = createDefaultState();
const app = createApp(state);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`BountyGraph API listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Health check: http://localhost:${PORT}/health`);
});
