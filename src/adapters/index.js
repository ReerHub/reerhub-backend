import { fetchAshbyJobs } from './ashby.adapter.js';
import { fetchCustomJobs } from './custom.adapter.js';
import { fetchGreenhouseJobs } from './greenhouse.adapter.js';
import { fetchLeverJobs } from './lever.adapter.js';
import { fetchSmartRecruitersJobs } from './smartrecruiters.adapter.js';

// Registry keyed by source.type, NOT by company.
// Why: scaling to 100 companies = adding DB rows, not new code.
// Each company row stores its board token in source.config.
const adapters = {
  greenhouse: fetchGreenhouseJobs,
  ashby: fetchAshbyJobs,
  lever: fetchLeverJobs,
  smartrecruiters: fetchSmartRecruitersJobs,
  custom: fetchCustomJobs,
};

export const getAdapter = (type) => {
  const adapter = adapters[type];
  if (!adapter) {
    throw new Error(`Unknown job source type: ${type}`);
  }
  return adapter;
};
