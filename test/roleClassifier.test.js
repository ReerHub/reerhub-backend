import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TECH_TRACKS,
  classifyRole,
  extractSkills,
  isIndiaRole,
  parseSeniority,
} from '../src/services/roleClassifier.service.js';

test('taxonomy exposes exactly the 9 tech tracks', () => {
  assert.deepEqual(TECH_TRACKS, [
    'software',
    'ai-ml',
    'data',
    'cloud-infra',
    'mobile',
    'security',
    'qa',
    'systems',
    'eng-management',
  ]);
});

test('classifies software roles with canonical titles', () => {
  const cases = [
    ['Software Development Engineer III -Backend', 'SDE'],
    ['Senior Backend Engineer', 'Backend Engineer'],
    ['Senior Frontend Engineer', 'Frontend Engineer'],
    ['Senior Fullstack Engineer - Codegen', 'Full Stack Engineer'],
    ['Member of Technical Staff, Core Product', 'Software Engineer'],
    ['Senior Software Engineer, Client Platform', 'Software Engineer'],
  ];
  for (const [title, role] of cases) {
    const result = classifyRole({ title });
    assert.equal(result.techTrack, 'software', title);
    assert.equal(result.techRole, role, title);
  }
});

test('classifies AI/ML roles ahead of generic engineering', () => {
  const cases = [
    ['Applied AI Scientist, Small Language Model', 'Applied Scientist'],
    ['AI Engineer, Internship', 'AI Engineer'],
    ['Head of AI Platform Engineering', 'ML Engineer'],
    ['Member of Technical Staff, AI Agent Development Lead', 'AI Engineer'],
    ['Senior GenAI Engineer', 'GenAI Engineer'],
    ['LLM Engineer, Inference', 'LLM Engineer'],
  ];
  for (const [title, role] of cases) {
    const result = classifyRole({ title });
    assert.equal(result.techTrack, 'ai-ml', title);
    assert.equal(result.techRole, role, title);
  }
});

test('classifies data, cloud, mobile, security, qa, systems roles', () => {
  const cases = [
    ['Data Engineer (SDE 2)', 'data', 'Data Engineer'],
    ['Senior Data Scientist', 'data', 'Data Scientist'],
    ['Analytics Engineer, Growth', 'data', 'Analytics Engineer'],
    ['Senior DevOps Engineer', 'cloud-infra', 'DevOps Engineer'],
    ['Staff Engineer – Observability Platform', 'cloud-infra', 'Platform Engineer'],
    ['Senior Engineer, IAM', 'cloud-infra', 'Cloud Engineer'],
    ['Infrastructure Engineer, Core', 'cloud-infra', 'Infrastructure Engineer'],
    ['Android Developer', 'mobile', 'Android Developer'],
    ['React Native Developer', 'mobile', 'React Native Developer'],
    ['Security Engineer 2', 'security', 'Security Engineer'],
    ['Principal Offensive Security Engineer', 'security', 'Security Engineer'],
    ['SDET-2 Backend', 'qa', 'SDET'],
    ['Senior QA Engineer', 'qa', 'QA Engineer'],
    ['Embedded Engineer, Firmware', 'systems', 'Embedded Engineer'],
    ['Network Engineer, DC', 'systems', 'Network Engineer'],
    ['Sales Engineer', 'systems', 'Solutions Engineer'],
    ['Solutions Architect - London, UK', 'systems', 'Solutions Engineer'],
    ['Lead - Solution Engineer', 'systems', 'Solutions Engineer'],
    ['Principal - Solution Engineering', 'systems', 'Solutions Engineer'],
    ['Principal Value Engineer', 'systems', 'Solutions Engineer'],
    ['Implementation Engineer', 'systems', 'Integration Engineer'],
  ];
  for (const [title, track, role] of cases) {
    const result = classifyRole({ title });
    assert.equal(result.techTrack, track, title);
    assert.equal(result.techRole, role, title);
  }
});

test('classifies engineering management', () => {
  const cases = [
    ['Engineering Manager -Backend', 'Engineering Manager'],
    ['Senior Engineering Manager, API Catalog', 'Senior Engineering Manager'],
    ['Head of Engineering, Infrastructure & SRE', 'Director of Engineering'],
    ['VP Engineering', 'VP Engineering'],
  ];
  for (const [title, role] of cases) {
    const result = classifyRole({ title });
    assert.equal(result.techTrack, 'eng-management', title);
    assert.equal(result.techRole, role, title);
  }
});

test('rejects real non-tech titles from live boards', () => {
  for (const title of [
    'Relationship Manager', // Groww
    'Assistant Manager - Internal Audit', // Groww
    'Portfolio Specialist - Wealth', // Groww
    'Account Executive', // Postman
    'Business Development Representative', // Enterpret
    "Founder's Office Chief of Staff",
    'Enterprise Account Executive',
    'Product Builder', // ambiguous product title, no tech signal
    'Senior Product Manager', // product is not in the 9-track taxonomy
    'Communication Designer',
    'Copywriter',
  ]) {
    const result = classifyRole({ title });
    assert.equal(result.techTrack, null, title);
    assert.equal(result.techRole, null, title);
  }
});

test('people-ops guard beats engineering keywords', () => {
  assert.equal(classifyRole({ title: 'Technical Recruiter' }).techTrack, null);
  assert.equal(classifyRole({ title: 'Talent Partner, Engineering' }).techTrack, null);
});

test('sales titles in AI business units stay non-tech', () => {
  assert.equal(
    classifyRole({
      title: 'Director – Sales, Meesho AI Services (MAS) | North India',
      department: 'AI Services',
    }).techTrack,
    null
  );
  assert.equal(
    classifyRole({
      title: 'Manager – GTM & Sales Strategy, Meesho AI Services (MAS)',
      department: 'AI Services',
    }).techTrack,
    null
  );
});

test('department is a fallback for tech departments only', () => {
  const result = classifyRole({ title: 'Product Builder', department: 'Engineering' });
  assert.equal(result.techTrack, 'software');
  assert.equal(result.techRole, 'Software Engineer');
  assert.equal(classifyRole({ title: 'Product Builder' }).techTrack, null);
});

test('parses seniority from titles', () => {
  const cases = [
    ['Software Engineer Intern', 'Intern'],
    ['SDE I, Backend', 'Junior'],
    ['SDE II, Frontend', 'Mid'],
    ['Software Development Engineer III -Backend', 'Senior'],
    ['Senior Backend Engineer', 'Senior'],
    ['Staff Software Engineer, Platform', 'Staff'],
    ['Principal Engineer, Core Product', 'Principal'],
    ['Tech Lead Manager - Product Engineering', 'Lead'],
    ['Engineering Manager -Backend', 'Manager'],
    ['Director of Engineering', 'Director'],
    ['VP Engineering', 'VP'],
    ['Backend Engineer', undefined],
  ];
  for (const [title, expected] of cases) {
    assert.equal(parseSeniority(title), expected, title);
    assert.equal(classifyRole({ title }).seniority, expected, title);
  }
});

test('detects India scope from normalized and raw locations', () => {
  assert.equal(isIndiaRole([]), true);
  assert.equal(
    isIndiaRole([{ city: 'Bengaluru', state: 'Karnataka', country: 'India' }]),
    true
  );
  assert.equal(isIndiaRole(['Bengaluru, Onsite']), true);
  assert.equal(isIndiaRole(['Remote']), true);
  assert.equal(isIndiaRole(['New York']), false);
  assert.equal(isIndiaRole(['Remote, Italy']), false);
  assert.equal(
    isIndiaRole([{ city: 'Remote', state: 'Italy', country: 'India' }]),
    false
  );
});

test('extracts skills without false hits', () => {
  const skills = extractSkills(
    'Senior Python Engineer with Django, Kafka and AWS. Go-getter wanted.'
  );
  assert.ok(skills.includes('python'));
  assert.ok(skills.includes('django'));
  assert.ok(skills.includes('kafka'));
  assert.ok(skills.includes('aws'));
  assert.ok(!skills.includes('golang'), 'go inside "go-getter" must not match');
});
