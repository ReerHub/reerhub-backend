/**
 * Deterministic tech taxonomy for ReerHub (pure tech platform).
 *
 * Two-level classification: 9 tech tracks, each with canonical roles.
 * `classifyRole()` returns { techTrack, techRole, seniority } or
 * { techTrack: null, ... } for non-tech titles (drop signal at ingestion).
 *
 * Scalability rule: tracks and roles are DATA in TAXONOMY below, not
 * branching logic. Adding a track = one object + tests. `taxonomyVersion`
 * on each job lets future classifier upgrades re-tag stale versions only.
 */

import escapeRegex from '../utils/escapeRegex.js';

export const TAXONOMY_VERSION = 2;

export const TECH_TRACKS = [
  'software',
  'ai-ml',
  'data',
  'cloud-infra',
  'mobile',
  'security',
  'qa',
  'systems',
  'eng-management',
];

// Checked FIRST: people-ops roles always win, even when the title
// contains "engineer" (e.g. "Technical Recruiter").
const PEOPLE_OPS_GUARDS = [
  'recruiter',
  'recruitment',
  'talent acquisition',
  'talent partner',
  'human resources',
  'hr business',
  'people operations',
  'people partner',
];

// Roles deliberately outside the 9 tracks (product/design leadership,
// program delivery). Listed explicitly so the intent is auditable.
const NON_TECH_ROLE_GUARDS = [
  'product manager',
  'product designer',
  'program manager',
  'scrum master',
  'data entry',
  'designer',
];

// Titles that look technical but are not engineering roles at ReerHub.
const NON_TECH_DESIGN_GUARDS = [
  'fashion designer',
  'textile designer',
  'interior designer',
];

// Business/support functions. Checked AFTER taxonomy so customer-facing
// engineers (Sales/Solutions/Support) keep their technical mapping.
const NON_TECH_GUARDS = [
  'account executive',
  'sales manager',
  'sales executive',
  'sales representative',
  'sales development',
  'sales strategy',
  'sales', // safe: sales engineer maps to systems/Solutions Engineer above
  'business development',
  'account manager',
  'customer success manager',
  'customer support',
  'support specialist',
  'marketing',
  'growth manager',
  'content writer',
  'content strategist',
  'seo',
  'social media',
  'finance',
  'accounting',
  'audit',
  'controller',
  'legal',
  'counsel',
  'compliance',
  'paralegal',
  'relationship manager',
  'wealth',
  'portfolio',
  'risk analyst',
  'underwriter',
  'business analyst',
  'operations manager',
  'office manager',
  'executive assistant',
  'chief of staff',
  "founder's office",
  'administrative',
  'receptionist',
  'hr ',
  ' human resource',
];

/**
 * Track order = match priority. Specific tracks run before the generic
 * software catch-all (bare 'engineer'/'developer' live there, so mobile,
 * security, etc. must precede it). eng-management precedes software so
 * "Engineering Manager" never falls into the catch-all.
 */
const TAXONOMY = [
  {
    track: 'ai-ml',
    roles: [
      { role: 'GenAI Engineer', patterns: ['genai', 'generative ai'] },
      { role: 'Applied Scientist', patterns: ['applied scientist', 'ai scientist'] },
      { role: 'LLM Engineer', patterns: ['language model', 'prompt engineer', 'llm'] },
      { role: 'AI Engineer', patterns: ['ai engineer', 'ai agent'] },
      {
        role: 'ML Engineer',
        patterns: [
          'ml engineer',
          'machine learning engineer',
          'machine learning',
          'deep learning',
          'mlops',
          'ml platform',
          'ai platform',
        ],
      },
      {
        role: 'Research Engineer',
        patterns: [
          'research engineer',
          'research scientist',
          'computer vision',
          'natural language',
          'artificial intelligence',
          'large language',
          'nlp',
        ],
      },
    ],
  },
  {
    track: 'eng-management',
    roles: [
      { role: 'CTO', patterns: ['cto', 'chief technology'] },
      {
        role: 'VP Engineering',
        patterns: ['vp engineering', 'vice president engineering', 'vp of engineering'],
      },
      {
        role: 'Director of Engineering',
        patterns: [
          'director of engineering',
          'director engineering',
          'head of engineering',
          'engineering director',
        ],
      },
      {
        role: 'Senior Engineering Manager',
        patterns: ['senior engineering manager', 'sr engineering manager'],
      },
      { role: 'Engineering Manager', patterns: ['engineering manager'] },
    ],
  },
  {
    track: 'data',
    roles: [
      { role: 'ML Data Engineer', patterns: ['ml data'] },
      { role: 'Data Scientist', patterns: ['data scientist', 'data science'] },
      { role: 'Analytics Engineer', patterns: ['analytics engineer', 'data analyst'] },
      {
        role: 'BI Engineer',
        patterns: ['bi engineer', 'bi developer', 'business intelligence'],
      },
      {
        role: 'Data Engineer',
        patterns: ['data engineer', 'data architect', 'database', 'dba'],
      },
    ],
  },
  {
    track: 'cloud-infra',
    roles: [
      { role: 'DevOps Engineer', patterns: ['devops', 'devsecops'] },
      { role: 'SRE', patterns: ['site reliability', ' sre '] },
      { role: 'Platform Engineer', patterns: ['platform engineer', 'observability'] },
      { role: 'Infrastructure Engineer', patterns: ['infrastructure engineer'] },
      { role: 'Cloud Architect', patterns: ['cloud architect'] },
      { role: 'Cloud Engineer', patterns: ['cloud engineer', 'infrastructure', 'iam'] },
    ],
  },
  {
    track: 'mobile',
    roles: [
      { role: 'Android Developer', patterns: ['android'] },
      { role: 'iOS Developer', patterns: ['ios', 'iphone'] },
      { role: 'Flutter Developer', patterns: ['flutter'] },
      { role: 'React Native Developer', patterns: ['react native'] },
      {
        role: 'Mobile Engineer',
        patterns: ['mobile engineer', 'mobile developer', 'mobile'],
      },
    ],
  },
  {
    track: 'security',
    roles: [
      { role: 'AppSec Engineer', patterns: ['application security', 'appsec'] },
      { role: 'Cloud Security Engineer', patterns: ['cloud security'] },
      { role: 'Cybersecurity Engineer', patterns: ['cybersecurity', 'cyber security'] },
      { role: 'Security Architect', patterns: ['security architect'] },
      {
        role: 'Security Engineer',
        patterns: ['security engineer', 'security analyst', 'offensive security'],
      },
    ],
  },
  {
    track: 'qa',
    roles: [
      { role: 'SDET', patterns: ['sdet'] },
      { role: 'Automation Engineer', patterns: ['automation engineer', 'automation'] },
      {
        role: 'Performance Engineer',
        patterns: ['performance engineer', 'performance testing'],
      },
      { role: 'Test Engineer', patterns: ['test engineer'] },
      { role: 'QA Engineer', patterns: ['qa engineer', ' qa '] },
    ],
  },
  {
    track: 'systems',
    roles: [
      { role: 'Embedded Engineer', patterns: ['embedded'] },
      { role: 'Firmware Engineer', patterns: ['firmware'] },
      { role: 'Network Engineer', patterns: ['network engineer', 'network'] },
      {
        role: 'Solutions Engineer',
        patterns: [
          'solutions engineer',
          'solution engineer',
          'solutions architect',
          'solutions consultant',
          'solution architect',
          'sales engineer',
          'value engineer',
        ],
      },
      {
        role: 'Integration Engineer',
        patterns: [
          'integration engineer',
          'implementation engineer',
          'support engineer',
          'success engineer',
        ],
      },
      { role: 'Systems Engineer', patterns: ['systems engineer'] },
    ],
  },
  {
    track: 'software',
    roles: [
      { role: 'SDE', patterns: ['software development engineer', ' sde '] },
      { role: 'Backend Engineer', patterns: ['backend', 'back-end'] },
      { role: 'Frontend Engineer', patterns: ['frontend', 'front-end'] },
      {
        role: 'Full Stack Engineer',
        patterns: ['fullstack', 'full-stack', 'full stack'],
      },
      // Generic catch-all, safe ONLY because software runs last — every
      // specific track already had its chance above.
      {
        role: 'Software Engineer',
        patterns: [
          'software engineer',
          'software developer',
          'member of technical staff',
          'software development',
          'technical program manager',
          'developer',
          'engineer',
        ],
      },
    ],
  },
];

// Department fallback when the title matches nothing. Maps to the generic
// Software Engineer role — a tech department with an odd title is still tech.
// NOTE: no bare 'ai' here — "AI Services" is often a business unit
// (e.g. Meesho sales roles), not a role signal.
const TECH_DEPARTMENTS = [
  'engineer',
  'technology',
  'software',
  'product',
  'data',
  'design',
  'research',
];

const INDIA_CITIES = [
  'bengaluru',
  'bangalore',
  'mumbai',
  'bombay',
  'delhi',
  'noida',
  'greater noida',
  'gurgaon',
  'gurugram',
  'hyderabad',
  'secunderabad',
  'chennai',
  'madras',
  'pune',
  'poona',
  'kolkata',
  'calcutta',
  'ahmedabad',
  'kochi',
  'cochin',
  'jaipur',
  'chandigarh',
  'indore',
  'surat',
  'nagpur',
  'lucknow',
  'coimbatore',
  'thiruvananthapuram',
  'trivandrum',
  'bhubaneswar',
  'mysuru',
  'mysore',
  'vijayawada',
  'visakhapatnam',
  'goa',
];

const INDIAN_STATES = [
  'karnataka',
  'maharashtra',
  'tamil nadu',
  'telangana',
  'kerala',
  'delhi',
  'haryana',
  'uttar pradesh',
  'gujarat',
  'rajasthan',
  'punjab',
  'west bengal',
  'madhya pradesh',
  'bihar',
  'odisha',
  'andhra pradesh',
];

// Any of these (without India evidence) marks the role non-India.
const NON_INDIA_MARKERS = [
  'united states',
  'united kingdom',
  'new york',
  'san francisco',
  'san jose',
  'austin',
  'boston',
  'seattle',
  'chicago',
  'los angeles',
  'california',
  'texas',
  'washington',
  'massachusetts',
  'london',
  'berlin',
  'paris',
  'amsterdam',
  'dublin',
  'toronto',
  'vancouver',
  'sydney',
  'melbourne',
  'singapore',
  'dubai',
  'germany',
  'france',
  'netherlands',
  'ireland',
  'canada',
  'australia',
  'italy',
  'spain',
  'poland',
  'portugal',
  'sweden',
  'israel',
  'tel aviv',
  'uae',
  'usa',
  ' u.s.',
  'uk ',
];

const SKILL_DICTIONARY = [
  'javascript',
  'typescript',
  'python',
  'java',
  'golang',
  'rust',
  'c++',
  'ruby',
  'php',
  'kotlin',
  'swift',
  'scala',
  'react',
  'angular',
  'vue',
  'next.js',
  'nodejs',
  'node.js',
  'express',
  'django',
  'flask',
  'fastapi',
  'spring',
  'spring boot',
  '.net',
  'aws',
  'azure',
  'gcp',
  'kubernetes',
  'k8s',
  'docker',
  'terraform',
  'kafka',
  'redis',
  'mongodb',
  'postgresql',
  'postgres',
  'mysql',
  'elasticsearch',
  'snowflake',
  'databricks',
  'spark',
  'airflow',
  'tensorflow',
  'pytorch',
  'scikit-learn',
  'langchain',
  'langgraph',
  'openai',
  'anthropic',
  'huggingface',
  'graphql',
  'rest api',
  'grpc',
  'ci/cd',
  'jenkins',
  'github actions',
  'figma',
  'tableau',
  'power bi',
  'linux',
  'bash',
  'flutter',
  'react native',
  'sql',
  'nosql',
];

const includesToken = (haystack, token) => {
  if (!token) return false;
  // Short tokens (llm, nlp, aws, sql, sde, sre, qa) need word boundaries to
  // avoid false hits ("llm" inside "bellman", "qa" inside "equal").
  if (/^[a-z0-9+#./]{1,4}$/.test(token)) {
    return new RegExp(`(?<![a-z0-9+#])${escapeRegex(token)}(?![a-z0-9+#])`).test(
      haystack
    );
  }
  return haystack.includes(token);
};

const matchesAny = (haystack, patterns) =>
  patterns.some((pattern) => includesToken(haystack, pattern));

/**
 * Extracts known tech skills from free text. Capped so a keyword-stuffed
 * description cannot blow up the document.
 */
export const extractSkills = (text, limit = 25) => {
  const haystack = ` ${(text || '').toLowerCase()} `;
  const found = [];
  for (const skill of SKILL_DICTIONARY) {
    if (includesToken(haystack, skill)) found.push(skill);
    if (found.length >= limit) break;
  }
  return found;
};

/**
 * India-scope check. Accepts normalized locations ([{city,state,country}])
 * or raw ATS strings. Empty location info defaults to India because the
 * boards indexed are Indian companies' own career pages.
 *
 * Precedence: explicit Indian city/state beats everything (the normalizer
 * defaults `country` to India, so a bare country match is weak evidence and
 * must NOT override an explicit non-India marker like "Remote, Italy").
 */
export const isIndiaRole = (locations) => {
  const items = Array.isArray(locations) ? locations : locations ? [locations] : [];
  if (items.length === 0) return true;

  const localeParts = [];
  const allParts = [];
  for (const location of items) {
    if (typeof location === 'string') {
      const lower = location.toLowerCase();
      localeParts.push(lower);
      allParts.push(lower);
    } else {
      for (const part of [location?.city, location?.state]) {
        if (part) localeParts.push(String(part).toLowerCase());
      }
      for (const part of [location?.city, location?.state, location?.country]) {
        if (part) allParts.push(String(part).toLowerCase());
      }
    }
  }
  const localeHaystack = ` ${localeParts.join(' ')} `;
  const fullHaystack = ` ${allParts.join(' ')} `;

  if (fullHaystack.includes('india') && !matchesAny(fullHaystack, NON_INDIA_MARKERS)) {
    return true;
  }
  if (matchesAny(localeHaystack, [...INDIA_CITIES, ...INDIAN_STATES])) return true;
  if (matchesAny(fullHaystack, NON_INDIA_MARKERS)) return false;
  // "Remote" with no country evidence: assume domestic for Indian boards.
  return true;
};

// Seniority ladder, most senior first. Roman-numeral SDE bands included.
const SENIORITY_LADDER = [
  {
    seniority: 'C-Level',
    patterns: [
      'cto',
      'chief technology',
      'chief executive',
      'ceo',
      'cio',
      'chief information',
    ],
  },
  { seniority: 'VP', patterns: ['vp ', 'vp of', 'vice president'] },
  { seniority: 'Director', patterns: ['director', 'head of'] },
  { seniority: 'Principal', patterns: ['principal'] },
  { seniority: 'Staff', patterns: ['staff'] },
  {
    seniority: 'Lead',
    patterns: ['tech lead', 'team lead', ' lead ', 'lead engineer', 'lead -'],
  },
  {
    seniority: 'Senior',
    patterns: ['senior', ' sr ', ' sr.', 'sde iii', 'sde 3', 'sde-iii', 'engineer iii'],
  },
  { seniority: 'Manager', patterns: ['manager'] },
  {
    seniority: 'Mid',
    patterns: [
      'sde ii',
      'sde 2',
      'sde-ii',
      'engineer ii',
      ' ii ',
      ' ii,',
      'mid-level',
      'mid level',
    ],
  },
  {
    seniority: 'Junior',
    patterns: [
      'junior',
      'associate',
      'trainee',
      'entry level',
      'entry-level',
      'fresher',
      'graduate',
      'sde i',
      'sde 1',
      'sde-i',
      'engineer i',
    ],
  },
];

/**
 * Parses seniority from a job title. Returns undefined when the title
 * carries no level signal (display omits it rather than guessing).
 */
export const parseSeniority = (title = '') => {
  const haystack = ` ${title.toLowerCase()} `;
  // Intern first with real word boundaries: "Internal Tools" must NOT match.
  if (/(?<![a-z])intern(ship)?(?![a-z])/.test(haystack)) return 'Intern';
  for (const { seniority, patterns } of SENIORITY_LADDER) {
    if (matchesAny(haystack, patterns)) return seniority;
  }
  return undefined;
};

/**
 * Classifies one normalized job into the tech taxonomy.
 * Returns { techTrack, techRole, seniority } — techTrack null means
 * non-tech (caller drops it at ingestion).
 */
export const classifyRole = ({ title = '', department = '' } = {}) => {
  const haystack = ` ${title} ${department}`.toLowerCase();
  const seniority = parseSeniority(title);

  if (matchesAny(haystack, PEOPLE_OPS_GUARDS))
    return { techTrack: null, techRole: null, seniority };
  if (matchesAny(haystack, NON_TECH_DESIGN_GUARDS))
    return { techTrack: null, techRole: null, seniority };
  if (matchesAny(haystack, NON_TECH_ROLE_GUARDS))
    return { techTrack: null, techRole: null, seniority };

  for (const { track, roles } of TAXONOMY) {
    for (const { role, patterns } of roles) {
      if (matchesAny(haystack, patterns))
        return { techTrack: track, techRole: role, seniority };
    }
  }

  if (matchesAny(haystack, NON_TECH_GUARDS))
    return { techTrack: null, techRole: null, seniority };

  const dept = department.toLowerCase();
  if (dept && matchesAny(` ${dept} `, TECH_DEPARTMENTS)) {
    return { techTrack: 'software', techRole: 'Software Engineer', seniority };
  }
  return { techTrack: null, techRole: null, seniority };
};
