// Mastra is optional - only used if needed
// Commented out to avoid type errors if packages aren't installed
// Uncomment and install packages if you need Mastra functionality

/*
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    default: { enabled: true },
  }),
});
*/

// Placeholder exports to avoid import errors
export const mastra = null;
export const weatherWorkflow = null;
export const weatherAgent = null;
