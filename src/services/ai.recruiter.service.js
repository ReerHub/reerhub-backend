import OpenAI from 'openai';
import ApiError from '../utils/ApiError.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.SERVER_URL || 'https://amanox.in',
    'X-Title': 'Amanox Recruiter AI',
  },
});

// Recruiters need precision, so we default to the smarter models
const AVAILABLE_MODELS = {
  gemini: { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  openai: { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  deepseek: { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
};

const JUDGE_MODEL = 'openai/gpt-4o-mini';

export const analyzeForRecruiter = async (
  resumeText,
  selectedModelKeys = [],
  jobDescription = null
) => {
  if (!resumeText || resumeText.length < 50) {
    throw new ApiError(400, 'Resume content is too short to analyze.');
  }

  // 1. Determine models to run based on selection
  let modelsToRun = [];
  if (selectedModelKeys && selectedModelKeys.length > 0) {
    modelsToRun = selectedModelKeys
      .filter((key) => AVAILABLE_MODELS[key])
      .map((key) => AVAILABLE_MODELS[key]);
  }

  // Fallback if no valid selection
  if (modelsToRun.length === 0) {
    modelsToRun = [AVAILABLE_MODELS.gemini, AVAILABLE_MODELS.openai];
  }

  const isJobMatch = !!jobDescription && jobDescription.length > 50;
  console.log(
    `🕴️ Starting RECRUITER Analysis with ${modelsToRun.length} models (${isJobMatch ? 'Screening Mode' : 'General Evaluation'})...`
  );

  // --- RECRUITER PROMPT (Critical & Objective) ---
  const prompt = `
    You are a Senior Technical Recruiter and Hiring Manager.
    Your job is to SCREEN this candidate critically. Do not be nice. Look for facts, gaps, and red flags.
    
    ${isJobMatch ? `COMPARE CANDIDATE AGAINST JOB DESCRIPTION.` : `EVALUATE CANDIDATE QUALITY.`}

    RESUME: "${resumeText.slice(0, 20000)}"
    ${isJobMatch ? `JOB DESCRIPTION: "${jobDescription.slice(0, 10000)}"` : ''}

    CRITICAL: Output valid JSON only.
    Structure:
    {
      "score": <0-100 Suitability Score>,
      "summary": "<Professional third-person assessment (e.g. 'The candidate demonstrates...')>",
      
      "section_scores": {
        "experience_relevance": <0-100>,
        "technical_depth": <0-100>,
        "education_quality": <0-100>
      },

      "keywords": {
        "present": ["<Matched Hard Skill>", ...],
        "missing": ["<Critical Missing Requirement>", ...] 
      },

      "red_flags": ["<Gap in employment>", "<Vague descriptions>", "<Formatting errors>"],

      "interview_questions": [
        {
          "question": "<Hard technical question based on their claims>",
          "context": "<Why ask this? (e.g. 'They claimed expert React knowledge')>"
        }
      ],
      
      "recommendation": "Interview" | "Shortlist" | "Reject"
    }
  `;

  // --- 1. RUN PANEL ---
  const modelPromises = modelsToRun.map(async (model) => {
    try {
      const completion = await openai.chat.completions.create({
        model: model.id,
        messages: [
          { role: 'system', content: 'You are a critical recruiter. JSON only.' },
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
      return { status: 'rejected', model: model.name, error: error.message };
    }
  });

  const results = await Promise.all(modelPromises);
  const successfulReviews = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.data);

  if (successfulReviews.length === 0) throw new ApiError(500, 'Screening failed.');

  // --- 2. THE JUDGE (Synthesizer) ---
  const synthesisPrompt = `
    You are the Head of Talent Acquisition.
    Synthesize these ${successfulReviews.length} screening reports into one Final Candidate Evaluation.
    
    INPUTS: ${JSON.stringify(successfulReviews)}

    OUTPUT JSON:
    {
      "score": <Average Score>,
      "summary": "<Objective Executive Summary>",
      "section_scores": { "experience_relevance": 0, "technical_depth": 0, "education_quality": 0 },
      "keywords": { "present": [], "missing": [] },
      "strengths": ["<Top Selling Point>", ...],
      "weaknesses": ["<Major Concern>", ...],
      "improvements": [], // Leave empty array to match frontend schema
      "red_flags": [],
      "interview_questions": [{ "question": "...", "context": "..." }]
    }
  `;

  try {
    const judgeCompletion = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [
        { role: 'system', content: 'JSON only.' },
        { role: 'user', content: synthesisPrompt },
      ],
    });
    let judgeContent = judgeCompletion.choices[0].message.content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const finalConsensus = JSON.parse(judgeContent);

    // Map "red_flags" to "weaknesses" so the Frontend displays them in the red box
    // But keep specific recruiter fields for later
    return {
      ...finalConsensus,
      weaknesses: finalConsensus.red_flags || finalConsensus.weaknesses,
      mode: isJobMatch ? 'job_match' : 'general',
      role_context: 'recruiter', // Flag for frontend
      model_reviews: results.map((r) => ({
        model: r.model,
        success: r.status === 'fulfilled',
        full_data: r.status === 'fulfilled' ? r.data : null,
      })),
    };
  } catch {
    const base = successfulReviews[0];
    return { ...base, role_context: 'recruiter' };
  }
};
