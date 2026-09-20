/**
 * SmartRecruiters adapter.
 * Docs: public postings API, no auth:
 *   GET https://api.smartrecruiters.com/v1/companies/{company}/postings?limit=100&offset=0
 * Config: { company: "Freshworks" } (the SmartRecruiters company identifier)
 * Why: deterministic JSON API, not HTML scraping. Stable IDs -> externalJobId.
 * Used by Freshworks (verified: 141 postings, ~18+ India tech roles).
 *
 * The list endpoint carries no descriptions, so each posting's detail
 * endpoint is fetched for the jobAd sections (description + qualifications).
 * A failed detail fetch falls back to list-level data instead of failing the
 * whole sync (per-job error isolation lives in sync.service, but a throw
 * here would poison all 140+ jobs, so details degrade gracefully).
 */
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

const API_BASE = 'https://api.smartrecruiters.com/v1/companies';
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // 5000-posting safety cap
const DETAIL_CONCURRENCY = 5;

// ISO codes -> names the India-scope classifier understands.
// Unknown codes fall back to fullLocation parsing, then the raw code.
const COUNTRY_NAMES = {
  in: 'India',
  us: 'United States',
  gb: 'United Kingdom',
  uk: 'United Kingdom',
  de: 'Germany',
  fr: 'France',
  nl: 'Netherlands',
  ie: 'Ireland',
  es: 'Spain',
  it: 'Italy',
  pl: 'Poland',
  se: 'Sweden',
  ca: 'Canada',
  au: 'Australia',
  sg: 'Singapore',
  my: 'Malaysia',
  ae: 'United Arab Emirates',
  qa: 'Qatar',
  sa: 'Saudi Arabia',
  jp: 'Japan',
  br: 'Brazil',
  mx: 'Mexico',
};

const resolveCountry = (location = {}) => {
  const code = String(location.country || '')
    .trim()
    .toLowerCase();
  if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code];
  // fullLocation looks like "Bengaluru, KA, India" — last segment is country.
  const segments = String(location.fullLocation || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length > 0) return segments[segments.length - 1];
  return location.country || undefined;
};

const toCommonShape = (company, posting, detail) => {
  const location = posting.location || {};
  const employment = posting.typeOfEmployment || {};
  const departmentLabel =
    posting.department?.label || posting.function?.label || undefined;

  const sections = detail?.jobAd?.sections || {};
  const description = [sections.jobDescription?.text, sections.qualifications?.text]
    .filter((text) => typeof text === 'string' && text.trim())
    .join('\n\n');

  const remoteType = location.remote ? 'remote' : location.hybrid ? 'hybrid' : 'onsite';

  return {
    externalJobId: String(posting.id),
    title: posting.name,
    rawTitle: posting.name,
    description,
    locations: {
      city: location.city || undefined,
      state: location.region || undefined,
      country: resolveCountry(location),
    },
    remoteType,
    employmentType: employment.label || undefined,
    department:
      departmentLabel && departmentLabel !== 'Other' ? departmentLabel : undefined,
    applicationUrl:
      detail?.postingUrl || `https://jobs.smartrecruiters.com/${company}/${posting.id}`,
    sourceUrl:
      detail?.postingUrl || `https://jobs.smartrecruiters.com/${company}/${posting.id}`,
    postedAt: posting.releasedDate ? new Date(posting.releasedDate) : undefined,
    raw: posting,
  };
};

const fetchDetail = async (company, id) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/${company}/postings/${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

// Bounded concurrency: 141 sequential detail fetches would take minutes.
const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

export const fetchSmartRecruitersJobs = async (source) => {
  const company = source.config?.company;
  if (!company) {
    throw new Error(`SmartRecruiters source "${source.name}" is missing config.company`);
  }

  // Phase 1: paginate the list endpoint (no descriptions here).
  const postings = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = `${API_BASE}/${company}/postings?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`SmartRecruiters fetch failed (${response.status}) for ${company}`);
    }
    const data = await response.json();
    const items = Array.isArray(data.content) ? data.content : [];
    postings.push(...items);
    if (items.length < PAGE_SIZE) break;
  }

  // Phase 2: detail per posting for descriptions (degrades gracefully).
  return mapWithConcurrency(postings, DETAIL_CONCURRENCY, async (posting) => {
    const detail = await fetchDetail(company, posting.id);
    return toCommonShape(company, posting, detail);
  });
};
