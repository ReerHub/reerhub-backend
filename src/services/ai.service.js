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

// --- THE EXPERT 3 (User Selected) ---
const AVAILABLE_MODELS = {
  // 1. Google Gemini 2.0 Flash (Fast, High Context)
  gemini: { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },

  // 2. OpenAI GPT-4o Mini (Cost-Effective Standard)
  openai: { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },

  // 3. DeepSeek V3.1 (High Intelligence)
  deepseek: { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
};

export const analyzeResume = async (resumeText, selectedModelKeys = []) => {
  if (!resumeText || resumeText.length < 50) {
    throw new ApiError(400, 'Resume content is too short to analyze.');
  }

  // 1. Filter selected models
  let modelsToRun = [];
  if (selectedModelKeys && selectedModelKeys.length > 0) {
    modelsToRun = selectedModelKeys
      .filter((key) => AVAILABLE_MODELS[key])
      .map((key) => AVAILABLE_MODELS[key]);
  }

  // Fallback: If nothing selected (or old keys sent), run Gemini & GPT-4o Mini
  if (modelsToRun.length === 0) {
    modelsToRun = [AVAILABLE_MODELS.gemini, AVAILABLE_MODELS.openai];
  }

  console.log(
    `🤖 Starting Analysis with ${modelsToRun.length} models: ${modelsToRun.map((m) => m.name).join(', ')}`
  );

  const prompt = `
    You are an expert ATS (Applicant Tracking System) and Resume Coach. 
    Analyze the following resume text.

    RESUME TEXT:
    "${resumeText.slice(0, 25000)}" 

    CRITICAL INSTRUCTION: 
    Output ONLY a valid JSON object. Do not include markdown formatting.
    The JSON structure must be exactly:
    {
      "score": <number 0-100>,
      "summary": "<2 sentence professional summary>",
      "strengths": ["<strength 1>", "<strength 2>", ...],
      "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
      "improvements": [
        {
          "section": "<e.g. Experience, Skills>",
          "suggestion": "<detailed advice>",
          "impact": "High" | "Medium" | "Low"
        }
      ],
      "keywords_found": ["<skill1>", "<skill2>", ...],
      "ats_compatibility": "High" | "Medium" | "Low"
    }
  `;

  // --- 2. RUN PARALLEL REQUESTS ---
  const modelPromises = modelsToRun.map(async (model) => {
    try {
      const completion = await openai.chat.completions.create({
        model: model.id,
        messages: [
          {
            role: 'system',
            content: 'You are a precise resume analyzer. Output JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        // Remove response_format for broader compatibility
      });

      let content = completion.choices[0].message.content;
      // Aggressive cleanup for models that chat too much
      content = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // Attempt to find JSON if model added conversational text
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        content = content.substring(jsonStart, jsonEnd + 1);
      }

      const parsedData = JSON.parse(content);

      return {
        status: 'fulfilled',
        model: model.name,
        data: parsedData,
      };
    } catch (error) {
      console.warn(`⚠️ Model ${model.name} failed:`, error.message);
      return { status: 'rejected', model: model.name, error: error.message };
    }
  });

  const results = await Promise.all(modelPromises);

  // --- 3. AGGREGATE RESULTS ---
  const successfulReviews = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.data);

  if (successfulReviews.length === 0) {
    throw new ApiError(
      500,
      'All selected AI models are currently busy or unavailable. Please try again later.'
    );
  }

  const totalScore = successfulReviews.reduce(
    (sum, review) => sum + (review.score || 0),
    0
  );
  const averageScore = Math.round(totalScore / successfulReviews.length);

  const bestResult = successfulReviews[0];

  return {
    ...bestResult,
    score: averageScore,
    model_reviews: results.map((r) => ({
      model: r.model,
      success: r.status === 'fulfilled',
      score: r.status === 'fulfilled' ? r.data.score : null,
      summary: r.status === 'fulfilled' ? r.data.summary : null,
      full_data: r.status === 'fulfilled' ? r.data : null,
    })),
  };
};
