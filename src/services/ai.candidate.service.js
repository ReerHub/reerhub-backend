import OpenAI from 'openai';
import ApiError from '../utils/ApiError.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.SERVER_URL || 'https://amanox.in',
    'X-Title': 'Amanox Pro Resume AI',
  },
});

// Define your "World's Best" model here
const PREMIUM_MODEL = process.env.PREMIUM_AI_MODEL || 'openai/gpt-4o';

export const analyzeForCandidate = async (
  resumeText,
  _ignoredModels,
  jobDescription = null
) => {
  if (!resumeText || resumeText.length < 50) {
    throw new ApiError(400, 'Resume content is too short.');
  }

  const isJobMatch = !!jobDescription && jobDescription.length > 50;

  // Optimized System Prompt for the single best model
  const prompt = `
    You are the World's Best ATS (Applicant Tracking System) Specialist and a Senior Career Coach known for high-impact results.

    ### MISSION
    Your goal is to provide a "Premium Audit" of the user's resume. You must find every technical gap while maintaining a motivating, supportive, and professional mentoring tone. Use clear, simple, and high-impact English. Avoid "corporate jargon" that is hard to understand.

    ### INPUT DATA
    RESUME TEXT: 
    """
    ${resumeText.slice(0, 15000)}
    """

    ${isJobMatch ? `TARGET JOB DESCRIPTION:\n"""${jobDescription.slice(0, 5000)}"""` : 'CONTEXT: General Career Optimization'}

    ### CRITICAL INSTRUCTIONS
    1. **The "Good" First:** Start by identifying real strengths. If they have good experience, celebrate it. Motivate them.
    2. **Tone:** Be a "Brutally Honest Friend." Don't hide the flaws, but explain how to fix them simply.
    3. **ATS Precision:** Identify specific keywords missing that would cause a filter to reject them.
    4. **Rewrites:** When suggesting rewrites, use the Google XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]".
    5. **Simple English:** Ensure the feedback is easy to read for non-native English speakers.

    ### REQUIRED JSON STRUCTURE (STRICT)
    {
      "score": <0-100 score based on ${isJobMatch ? 'JD match' : 'market standards'}>,
      
      "summary_candidate": "<Start with a positive 'Win'. Address the user as 'You'. Mention 2 strengths, then 1 major area for growth. End with a motivating sentence. (Max 4 lines)>",
      "summary_recruiter": "<Objective 3-line summary of why this candidate is or isn't a fit for a high-tier role.>",

      "section_scores": {
        "impact": <How well they show results/numbers>,
        "skills": <Technical depth>,
        "formatting": <Readability and structure>
      },

      "keywords": {
        "present": ["list found keywords"],
        "missing": ["list missing high-value keywords"]
      },

      "strengths": ["Clear, bulleted points of what they did right"],
      "weaknesses": ["Clear, honest points of what is holding them back"],

      "rewrites": [
        {
          "original": "The weak line from the resume",
          "improved": "The high-impact version of that line",
          "reason": "Why this change helps (e.g., 'Adds a measurable result')"
        }
      ],

      "improvements": [
        { 
          "section": "e.g., Experience", 
          "suggestion": "Specific advice in simple English", 
          "impact": "High/Medium" 
        }
      ],

      "projects_to_add": [
        { 
          "title": "Project name idea", 
          "reason": "Why this fills a gap in their current profile", 
          "value": "What skill this proves to employers" 
        }
      ],

      "spelling_errors": ["List any typos found"],

      "dev_maturity": {
        "seniority_score": <0-100>,
        "communication_score": <0-100>,
        "business_understanding_score": <0-100>
      },

      "interview_risks": [
        {
          "area": "Specific gap",
          "why": "Why a recruiter might worry",
          "fix": "How to answer this in an interview"
        }
      ],
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: PREMIUM_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a professional resume auditor. Return JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const data = JSON.parse(response.choices[0].message.content);
    return {
      ...data,
      mode: isJobMatch ? 'job_match' : 'general',
      role_context: 'candidate',
      model_used: 'Amanox Pro Intelligence', // Abstracted name for user
    };
  } catch (error) {
    console.error('AI Service Error:', error);
    throw new ApiError(500, 'Failed to analyze resume with our premium engine.');
  }
};
