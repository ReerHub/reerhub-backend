// src/services/ai.candidate.service.js

import OpenAI from 'openai';
import ApiError from '../utils/ApiError.js';

// -----------------------
// AI Client
// -----------------------
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.SERVER_URL || 'https://amanox.in',
    'X-Title': 'Amanox Resume AI',
  },
});

// -----------------------
// ACTIVE MODELS
// -----------------------
const AVAILABLE_MODELS = {
  gemini: { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash' },
  openai: { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
  deepseek: { id: 'x-ai/grok-3-mini', name: 'Grok-3 Mini' },
};

const JUDGE_MODEL = 'openai/gpt-5-mini';

// -----------------------
// Utility: Safe JSON Parsing
// -----------------------
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    // try extracting JSON fragment
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// -----------------------
// Utility: Average
// -----------------------
const avg = (arr) =>
  Math.round(
    arr.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) / arr.length
  );

// -----------------------
// MAIN FUNCTION
// -----------------------
export const analyzeForCandidate = async (
  resumeText,
  selectedModelKeys = [],
  jobDescription = null
) => {
  if (!resumeText || resumeText.length < 50) {
    throw new ApiError(400, 'Resume content is too short to analyze.');
  }

  // Models to run
  let modelsToRun = [];
  if (selectedModelKeys?.length > 0) {
    modelsToRun = selectedModelKeys
      .filter((k) => AVAILABLE_MODELS[k])
      .map((k) => AVAILABLE_MODELS[k]);
  }
  if (modelsToRun.length === 0) {
    modelsToRun = Object.values(AVAILABLE_MODELS);
  }

  const isJobMatch = !!jobDescription && jobDescription.length > 50;

  // -----------------------
  // Panel Prompt
  // -----------------------
  const panelPrompt = `
You are an expert ATS + Senior Hiring Manager.

Analyze the resume ${
    isJobMatch ? 'against the Job Description' : 'for general optimization'
  }.

RESUME:
"""
${resumeText.slice(0, 15000)}
"""

${isJobMatch ? `JOB DESCRIPTION:\n"""${jobDescription.slice(0, 5000)}"""\n` : ''}

CRITICAL:
Return ONLY JSON. No explanations, no markdown, no backticks.

REQUIRED JSON STRUCTURE:
{
  "score": <0-100>,
  "summary": "<2-3 sentence summary>",
  "section_scores": {
    "impact": <0-100>,
    "skills": <0-100>,
    "formatting": <0-100>
  },
  "strengths": ["..."],
  "weaknesses": ["..."],

  "keywords": {
    "present": ["react", "nodejs"],
    "missing": ["docker", "kubernetes"]
  },

  "rewrites": [
    {
      "original": "...",
      "improved": "...",
      "reason": "..."
    }
  ],

  "spelling_errors": ["..."],

  "improvements": [
    { "section": "Skills", "suggestion": "...", "impact": "High" }
  ],

  "projects_to_add": [
    { "title": "...", "reason": "...", "value": "..." }
  ]
}
`;

  // -----------------------
  // Phase 1: Run all models in parallel
  // -----------------------
  const panelResults = await Promise.all(
    modelsToRun.map(async (model) => {
      try {
        const resp = await openai.chat.completions.create({
          model: model.id,
          messages: [
            { role: 'system', content: 'Return JSON only.' },
            { role: 'user', content: panelPrompt },
          ],
        });

        let content = resp.choices[0].message.content || '';
        content = content.replace(/```json|```/g, '').trim();

        const parsed = safeJsonParse(content);
        if (!parsed) throw new Error('Invalid JSON from model');

        // fill missing fields so UI never breaks
        parsed.section_scores ||= {
          impact: 50,
          skills: 50,
          formatting: 50,
        };
        parsed.keywords ||= { present: [], missing: [] };
        parsed.strengths ||= [];
        parsed.weaknesses ||= [];
        parsed.rewrites ||= [];
        parsed.spelling_errors ||= [];
        parsed.improvements ||= [];
        parsed.projects_to_add ||= [];

        return {
          success: true,
          model: model.name,
          raw: content,
          data: parsed,
        };
      } catch (err) {
        return {
          success: false,
          model: model.name,
          error: err.message,
        };
      }
    })
  );

  const successful = panelResults.filter((r) => r.success).map((r) => r.data);

  if (successful.length === 0)
    throw new ApiError(500, 'All AI models failed. Try again.');

  // -----------------------
  // Phase 2: Judge Prompt
  // -----------------------
  const judgePrompt = `
You are the Chief AI Editor for Amanox Resume AI.

You receive multiple ATS-level analyses of the SAME candidate resume.
Your job is to MERGE all analyses into one perfect final report.

IMPORTANT:
- If a Job Description (JD) was provided, personalize ALL feedback + messages to match it.
- Use the strongest achievements, metrics, and skills found in the analyses.
- Maintain a mentoring tone for the candidate summary.
- Maintain a recruiter-facing, objective tone for the recruiter summary.

INPUT_ANALYSES:
${JSON.stringify(successful)}

OUTPUT STRICT JSON ONLY. NO MARKDOWN.

OUTPUT FORMAT:
{
  "score": <0-100>,

  "summary_candidate": "<Address the candidate as 'You'. 3–4 lines. Include strengths, domain, achievements, career positioning.>",
  "summary_recruiter": "<Address the hiring manager. 3–4 lines. State role fit, experience, KPIs, technical depth, and leadership qualities.>",

  "section_scores": {
    "impact": <0-100>,
    "skills": <0-100>,
    "formatting": <0-100>
  },

  "keywords": {
    "present": ["..."],
    "missing": ["..."]
  },

  "strengths": ["..."],
  "weaknesses": ["..."],

  "rewrites": [
    { "original": "...", "improved": "...", "reason": "..." }
  ],

  "improvements": [
    { "section": "...", "suggestion": "...", "impact": "High" }
  ],

  "projects_to_add": [
    {
      "title": "...",
      "reason": "Why this project increases hiring probability",
      "value": "What measurable impact it demonstrates"
    }
  ],

  "spelling_errors": ["..."],

  "dev_maturity": {
    "seniority_score": <0-100>,
    "communication_score": <0-100>,
    "business_understanding_score": <0-100>
  },

  "interview_risks": [
    {
      "area": "<Skill gap or missing detail>",
      "why": "<Why this might concern a recruiter>",
      "fix": "<Exact action to remove this risk>"
    }
  ],

  "outreach": {
    "linkedin": "<3–5 line LinkedIn outreach pitch tailored to specific JD (if available). Include tools, metrics, achievements, and why the candidate fits this exact role.>",
    "email": "<Full email: subject + body. Highly personalized. Include 1–2 achievements, exact alignment with JD, call-to-action.>",
    "recruiter_message": "<Short conversational message recruiter can paste into ATS chat or WhatsApp. Warm, confident, measurable, JD-aligned.>"
  }
}
`;

  // -----------------------
  // Run JUDGE
  // -----------------------
  let finalData;

  try {
    const judge = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: judgePrompt },
      ],
    });

    let judgeContent = judge.choices[0].message.content || '';
    judgeContent = judgeContent.replace(/```json|```/g, '').trim();

    finalData = safeJsonParse(judgeContent);

    if (!finalData) throw new Error('Judge invalid JSON');
  } catch {
    // ---------------------------
    // Fallback Merge (no judge)
    // ---------------------------
    const scores = successful.map((s) => s.score);
    const first = successful[0];

    finalData = {
      score: avg(scores),
      summary_candidate: first.summary,
      summary_recruiter: first.summary,
      section_scores: first.section_scores,
      keywords: first.keywords,
      strengths: first.strengths,
      weaknesses: first.weaknesses,
      rewrites: first.rewrites,
      improvements: first.improvements,
      projects_to_add: first.projects_to_add,
      spelling_errors: first.spelling_errors,
      dev_maturity: {
        seniority_score: avg(scores),
        communication_score: avg([first.section_scores.impact]),
        business_understanding_score: avg([first.section_scores.impact]),
      },
      interview_risks: first.weaknesses.map((w) => ({
        area: w,
        why: 'Identified as weakness',
        fix: 'Add metrics and clarity',
      })),
      outreach: {
        linkedin: "Hi, I'd like to apply...",
        email: 'Hello recruiter...',
        recruiter_message: 'Short pitch...',
      },
    };
  }

  // -----------------------
  // Add metadata for UI
  // -----------------------
  return {
    ...finalData,
    mode: isJobMatch ? 'job_match' : 'general',
    role_context: 'candidate',
    model_reviews: panelResults.map((r) => ({
      model: r.model,
      success: r.success,
      score: r.success ? r.data.score : null,
      summary: r.success ? r.data.summary : null,
      full_data: r.success ? r.data : null,
      raw: r.raw || null,
      error: r.error || null,
    })),
  };
};
