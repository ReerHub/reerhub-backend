/**
 * Greenhouse adapter.
 * Docs: https://developers.greenhouse.io/harvest.html (Job Board API, no auth)
 * Config: { boardToken: "razorpay" }
 * Why: deterministic JSON API, not HTML scraping. Stable IDs -> externalJobId.
 */
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

export const fetchGreenhouseJobs = async (source) => {
  const boardToken = source.config?.boardToken;
  if (!boardToken) {
    throw new Error(`Greenhouse source "${source.name}" is missing config.boardToken`);
  }

  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Greenhouse fetch failed (${response.status}) for ${boardToken}`);
  }

  const data = await response.json();
  return (data.jobs || []).map((job) => ({
    externalJobId: String(job.id),
    title: job.title,
    rawTitle: job.title,
    description: job.content || '',
    locations: job.location?.name || '',
    employmentType:
      job.metadata?.find((m) => m.name === 'Employment Type')?.value || undefined,
    department: job.departments?.[0]?.name || undefined,
    applicationUrl: job.absolute_url,
    sourceUrl: job.absolute_url,
    postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
    raw: job,
  }));
};
