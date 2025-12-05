import OpenAI from 'openai';
import ApiError from '../utils/ApiError.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.SERVER_URL || 'https://amanox.in',
    'X-Title': 'Amanox Resume AI',
  },
});

// --- THE EXPERT 3 (User Specified) ---
const AVAILABLE_MODELS = {
  gemini: { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash' },
  openai: { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
  deepseek: { id: 'x-ai/grok-3-mini', name: 'Grok-3 Mini' },
};

// --- THE JUDGE ---
// Using one of the approved models for the final synthesis step
const JUDGE_MODEL = 'openai/gpt-5-mini';

export const analyzeForCandidate = async (
  resumeText,
  selectedModelKeys = [],
  jobDescription = null
) => {
  if (!resumeText || resumeText.length < 50) {
    throw new ApiError(400, 'Resume content is too short to analyze.');
  }

  // 1. Filter selected models
  let modelsToRun = [];
  if (selectedModelKeys?.length > 0) {
    modelsToRun = selectedModelKeys
      .filter((key) => AVAILABLE_MODELS[key])
      .map((key) => AVAILABLE_MODELS[key]);
  }

  // Fallback: Run all 3 if nothing selected
  if (modelsToRun.length === 0) {
    modelsToRun = [
      AVAILABLE_MODELS.gemini,
      AVAILABLE_MODELS.openai,
      AVAILABLE_MODELS.deepseek,
    ];
  }

  const isJobMatch = !!jobDescription && jobDescription.length > 50;
  console.log(
    `🤖 PHASE 1: Panel Analysis with ${modelsToRun.length} models (${modelsToRun.map((m) => m.name).join(', ')})...`
  );

  // --- PHASE 1: PARALLEL ANALYSIS ---
  const prompt = `
    You are an expert ATS. Analyze this resume ${isJobMatch ? 'against the Job Description' : ''}.
    RESUME: "${resumeText.slice(0, 15000)}"
    ${isJobMatch ? `JOB DESCRIPTION: "${jobDescription.slice(0, 5000)}"` : ''}
    
    CRITICAL: Output ONLY valid JSON.
    Structure: {
      "score": <0-100>,
      "summary": "<Professional summary>",
      "strengths": ["<Point 1>", ...],
      "weaknesses": ["<Point 1>", ...],
      "improvements": [{ "section": "...", "suggestion": "...", "impact": "High" }],
      "keywords_found": ["..."]
    }
  `;

  const modelPromises = modelsToRun.map(async (model) => {
    try {
      const completion = await openai.chat.completions.create({
        model: model.id,
        messages: [
          { role: 'system', content: 'Output JSON only.' },
          { role: 'user', content: prompt },
        ],
      });

      let content = completion.choices[0].message.content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1)
        content = content.substring(firstBrace, lastBrace + 1);

      return { status: 'fulfilled', model: model.name, data: JSON.parse(content) };
    } catch (error) {
      console.warn(`⚠️ Model ${model.name} failed:`, error.message);
      return { status: 'rejected', model: model.name, error: error.message };
    }
  });

  const results = await Promise.all(modelPromises);
  const successfulReviews = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.data);

  if (successfulReviews.length === 0) {
    throw new ApiError(500, 'All AI models failed. Please try again.');
  }

  // --- PHASE 2: THE JUDGE (SYNTHESIS) ---
  const synthesisPrompt = `
    You are the Chief AI Editor at Amanox.
    You have received ${successfulReviews.length} different analyses of the same resume.
    
    MERGE them into one perfect, definitive report.
    
    INPUT DATA:
    ${JSON.stringify(successfulReviews)}

    CRITICAL TASKS:
    1. Calculate the final score (average of inputs).
    2. Merge "Strengths" and "Weaknesses".
    3. GENERATE TWO SUMMARIES:
       - "summary_candidate": Addressed to the user ("You are...").
       - "summary_recruiter": Addressed to a hiring manager ("The candidate is...").

    OUTPUT JSON STRUCTURE ONLY:
    {
      "score": <number>,
      "summary_candidate": "<String>",
      "summary_recruiter": "<String>",
      "section_scores": { "impact": <0-100>, "skills": <0-100>, "formatting": <0-100> },
      "keywords": { "present": [], "missing": [] },
      "strengths": [],
      "weaknesses": [],
      "improvements": [{ "section": "...", "suggestion": "...", "impact": "High" }],
      "spelling_errors": [],
      "rewrites": [{ "original": "...", "improved": "...", "reason": "..." }],
      "outreach": { "linkedin": "...", "email": "..." }
    }
  `;

  try {
    const judgeCompletion = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [
        { role: 'system', content: 'Output JSON only.' },
        { role: 'user', content: synthesisPrompt },
      ],
    });

    let judgeContent = judgeCompletion.choices[0].message.content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    const finalConsensus = JSON.parse(judgeContent);

    return {
      ...finalConsensus,
      mode: isJobMatch ? 'job_match' : 'general',
      role_context: 'candidate',
      model_reviews: results.map((r) => ({
        model: r.model,
        success: r.status === 'fulfilled',
        score: r.status === 'fulfilled' ? r.data.score : null,
        summary: r.status === 'fulfilled' ? r.data.summary : null,
        full_data: r.status === 'fulfilled' ? r.data : null,
      })),
    };
  } catch {
    const base = successfulReviews[0];
    return {
      ...base,
      score: Math.round(
        successfulReviews.reduce((a, b) => a + b.score, 0) / successfulReviews.length
      ),
      summary_candidate: base.summary,
      summary_recruiter: base.summary,
      mode: isJobMatch ? 'job_match' : 'general',
      role_context: 'candidate',
      model_reviews: results,
    };
  }
};
