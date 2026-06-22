/**
 * Career Mentor AI Response Transformer
 * 
 * Simplified for v2.3 to handle top 3 career role recommendations
 */

export interface CareerRecommendation {
  title: string;
  whyFit: string;
  salaryRange: string;
  matchScore: number;
  level: string;
  skills: string[];
}

export interface MentorReport {
  recommendations: CareerRecommendation[];
  fromCache?: boolean;
  generatedDate?: string;
}

/**
 * Main transformation function for the Career Mentor API response.
 * Handles the streamlined v2.3 response schema.
 */
export function transformResponse(data: any): MentorReport {
  if (!data) return { recommendations: [] };

  // Handle n8n response variants (direct body or wrapped in json field)
  let rawData = data;
  if (Array.isArray(data) && data.length > 0) {
    rawData = data[0].json || data[0];
  } else if (data.json) {
    rawData = data.json;
  } else if (data.output) {
    rawData = data.output;
  }

  const recommendations = (rawData.recommendations || rawData.roles || []).map((rec: any) => ({
    title: rec.title || rec.fieldName || 'Unknown Role',
    whyFit: rec.whyFit || rec.whyItFits || rec.whyBestFit || 'No description provided.',
    salaryRange: rec.salaryRange || rec.estimatedSalary || 'Competitive',
    matchScore: Number(rec.matchScore || rec.confidenceScore) || 0,
    level: rec.level || rec.difficultyLevel || 'Intermediate',
    skills: Array.isArray(rec.skills) ? rec.skills : 
            (rec.skillsToLearn ? [...(rec.skillsToLearn.technical || []), ...(rec.skillsToLearn.soft || [])] : [])
  }));

  return {
    recommendations: recommendations.slice(0, 3),
    fromCache: !!rawData.fromCache,
    generatedDate: rawData.generatedAt || new Date().toLocaleDateString()
  };
}