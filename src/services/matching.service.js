const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const overlap = (left = [], right = []) => {
  const candidates = new Set(left.map(normalize).filter(Boolean));
  return right.filter((item) => candidates.has(normalize(item)));
};

const jobCities = (job) =>
  (job.locations || []).map((location) => normalize(location.city));

export const scoreJobForProfile = (profile = {}, job) => {
  let score = 0;
  const reasons = [];
  const matchingSkills = overlap(profile.skills, job.skills);
  if (matchingSkills.length) {
    score += Math.min(42, matchingSkills.length * 14);
    reasons.push(`Matches ${matchingSkills.slice(0, 3).join(', ')}`);
  }
  if (profile.techTrack && profile.techTrack === job.techTrack) {
    score += 24;
    reasons.push('Matches your tech track');
  }
  const targetRoles = [profile.currentRole, ...(profile.techRoles || [])]
    .map(normalize)
    .filter(Boolean);
  if (
    targetRoles.some(
      (role) =>
        normalize(job.title).includes(role) || normalize(job.techRole).includes(role)
    )
  ) {
    score += 16;
    reasons.push('Aligned with your target role');
  }
  if (profile.city && jobCities(job).includes(normalize(profile.city))) {
    score += 8;
    reasons.push(`Available in ${profile.city}`);
  } else if (
    profile.remoteType &&
    profile.remoteType !== 'unknown' &&
    profile.remoteType === job.remoteType
  ) {
    score += 6;
    reasons.push(`Matches your ${profile.remoteType} preference`);
  }
  const ageMs =
    Date.now() - new Date(job.firstSeenAt || job.postedAt || Date.now()).getTime();
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) {
    score += 10;
    reasons.push('Freshly indexed role');
  }
  if (profile.experienceYears !== undefined && job.experience?.min !== undefined) {
    const years = Number(profile.experienceYears);
    if (
      years >= job.experience.min &&
      (job.experience.max === undefined || years <= job.experience.max + 2)
    ) {
      score += 8;
      reasons.push('Experience range is compatible');
    } else if (years + 2 < job.experience.min) {
      score -= 12;
    }
  }
  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 4) };
};

export const profileCompleteness = (profile = {}) => {
  const fields = ['headline', 'currentRole', 'techTrack', 'city', 'experienceYears'];
  const completed =
    fields.filter((field) => profile[field] !== undefined && profile[field] !== '')
      .length + (profile.skills?.length ? 1 : 0);
  return Math.round((completed / 6) * 100);
};
