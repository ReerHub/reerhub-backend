const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeLocation = (location) => {
  if (typeof location === 'string') {
    const [city, state, country] = location.split(',').map((part) => part.trim());
    return { city, state, country: country || 'India' };
  }

  return {
    city: toTrimmedString(location?.city),
    state: toTrimmedString(location?.state),
    country: toTrimmedString(location?.country) || 'India',
  };
};

const normalizeLocations = (locations) => {
  const items = Array.isArray(locations) ? locations : locations ? [locations] : [];
  return items
    .map(normalizeLocation)
    .filter((location) => location.city || location.state);
};

const normalizeSkills = (skills) => {
  const values = Array.isArray(skills)
    ? skills
    : typeof skills === 'string'
      ? skills.split(',')
      : [];
  return [...new Set(values.map(toTrimmedString).filter(Boolean))];
};

const normalizeExperience = (experience) => {
  if (!experience || typeof experience !== 'object') return undefined;

  const min = Number.isFinite(experience.min) ? experience.min : undefined;
  const max = Number.isFinite(experience.max) ? experience.max : undefined;
  return min === undefined && max === undefined ? undefined : { min, max };
};

const normalizeSalary = (salary) => {
  if (!salary || typeof salary !== 'object') return undefined;

  const min = Number.isFinite(salary.min) ? salary.min : undefined;
  const max = Number.isFinite(salary.max) ? salary.max : undefined;
  if (min === undefined && max === undefined) return undefined;

  return {
    min,
    max,
    currency: toTrimmedString(salary.currency) || 'INR',
    period: salary.period,
  };
};

/**
 * Converts an adapter result into the common job shape used by every source.
 * Adapters must provide title, applicationUrl, and sourceUrl at minimum.
 */
export const normalizeRawJob = (rawJob) => {
  const title = toTrimmedString(rawJob.title || rawJob.rawTitle);
  const applicationUrl = toTrimmedString(rawJob.applicationUrl);
  const sourceUrl = toTrimmedString(rawJob.sourceUrl || applicationUrl);

  if (!title) throw new Error('Job title is required');
  if (!applicationUrl) throw new Error('Job applicationUrl is required');
  if (!sourceUrl) throw new Error('Job sourceUrl is required');

  return {
    externalJobId: toTrimmedString(rawJob.externalJobId) || undefined,
    rawTitle: toTrimmedString(rawJob.rawTitle || title),
    title,
    normalizedTitle: toTrimmedString(rawJob.normalizedTitle) || undefined,
    description: typeof rawJob.description === 'string' ? rawJob.description.trim() : '',
    locations: normalizeLocations(rawJob.locations),
    remoteType: ['onsite', 'hybrid', 'remote'].includes(rawJob.remoteType)
      ? rawJob.remoteType
      : 'unknown',
    employmentType: toTrimmedString(rawJob.employmentType) || undefined,
    department: toTrimmedString(rawJob.department) || undefined,
    experience: normalizeExperience(rawJob.experience),
    salary: normalizeSalary(rawJob.salary),
    skills: normalizeSkills(rawJob.skills),
    seniority: toTrimmedString(rawJob.seniority) || undefined,
    applicationUrl,
    sourceUrl,
    postedAt: rawJob.postedAt ? new Date(rawJob.postedAt) : undefined,
    raw: rawJob.raw || rawJob,
  };
};
