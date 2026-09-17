import '../config/env.js';
import mongoose from 'mongoose';

import connectDB, { disconnectDB } from '../config/db.js';
import Company from '../models/company.model.js';
import JobSource from '../models/jobSource.model.js';

// Idempotent seed: safe to re-run. Uses slug / (companyId+careersUrl) as identity.
const COMPANIES = [
  {
    name: 'Razorpay',
    slug: 'razorpay',
    website: 'https://razorpay.com',
    careersUrl: 'https://razorpay.com/jobs/',
    industry: 'Fintech',
    sources: [
      {
        type: 'greenhouse',
        name: 'Razorpay Greenhouse board',
        careersUrl: 'https://job-boards.greenhouse.io/razorpaysoftwareprivatelimited',
        config: { boardToken: 'razorpaysoftwareprivatelimited', allowEmptyResult: false },
      },
    ],
  },
  {
    name: 'CRED',
    slug: 'cred',
    website: 'https://cred.club',
    careersUrl: 'https://cred.club/careers',
    industry: 'Fintech',
    sources: [
      {
        type: 'lever',
        name: 'CRED Lever board',
        careersUrl: 'https://jobs.lever.co/cred',
        config: { leverOrg: 'cred', allowEmptyResult: false },
      },
    ],
  },
  {
    name: 'Meesho',
    slug: 'meesho',
    website: 'https://www.meesho.com',
    careersUrl: 'https://www.meesho.com/careers',
    industry: 'E-commerce',
    sources: [
      {
        type: 'lever',
        name: 'Meesho Lever board',
        careersUrl: 'https://jobs.lever.co/meesho',
        config: { leverOrg: 'meesho', allowEmptyResult: false },
      },
    ],
  },
];

const seed = async () => {
  await connectDB();

  for (const entry of COMPANIES) {
    const company = await Company.findOneAndUpdate(
      { slug: entry.slug },
      {
        $setOnInsert: { name: entry.name, slug: entry.slug },
        $set: {
          website: entry.website,
          careersUrl: entry.careersUrl,
          industry: entry.industry,
          country: 'India',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`- company: ${company.slug} (${company._id})`);

    for (const source of entry.sources) {
      await JobSource.findOneAndUpdate(
        { companyId: company._id, careersUrl: source.careersUrl },
        {
          $setOnInsert: { companyId: company._id, careersUrl: source.careersUrl },
          $set: {
            type: source.type,
            name: source.name,
            config: source.config,
            isActive: true,
          },
        },
        { upsert: true }
      );
      console.log(`  - source: ${source.name}`);
    }

    // Deactivate stale sources (e.g. old custom placeholders) so daily
    // scheduler only syncs the current ATS boards.
    const activeUrls = entry.sources.map((s) => s.careersUrl);
    const deactivated = await JobSource.updateMany(
      { companyId: company._id, careersUrl: { $nin: activeUrls }, isActive: true },
      { $set: { isActive: false } }
    );
    if (deactivated.modifiedCount > 0) {
      console.log(`  - deactivated ${deactivated.modifiedCount} stale source(s)`);
    }
  }

  await mongoose.connection.close();
  await disconnectDB();
  console.log('Seed complete');
};

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
