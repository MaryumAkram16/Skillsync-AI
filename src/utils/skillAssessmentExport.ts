/**
 * Export/download logic extracted from skill-assessment.tsx. These were
 * pure functions already (no dependency on component state beyond the
 * `results` object passed in) — just moved as-is, with CATEGORY_CONFIG now
 * imported from the extracted constants file instead of local scope.
 */
import { CATEGORY_CONFIG } from "./skillAssessmentConstants";

export function downloadFile(content: string, fileName: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildAssessmentCSV(results: any): string {
  let csvContent = "";

  // Section 1: Summary Info
  csvContent += "SKILL SYNC ASSESSMENT REPORT\n";
  csvContent += `Generated At,${new Date().toLocaleString()}\n`;
  csvContent += `Overall Score,${results.score}%\n`;
  csvContent += `Skill Level,${results.skillLevel}\n`;
  csvContent += `Message,"${(results.message || "").replace(/"/g, '""')}"\n`;
  csvContent += `Feedback,"${(results.feedback || "").replace(/"/g, '""')}"\n\n`;

  // Section 2: Category Ratings
  if (results.categoryScores && Object.keys(results.categoryScores).length > 0) {
    csvContent += "CATEGORY SCORES\n";
    csvContent += "Category,Score (%)\n";
    Object.entries(results.categoryScores).forEach(([key, value]) => {
      const label = CATEGORY_CONFIG[key]?.label ?? key;
      csvContent += `"${label.replace(/"/g, '""')}",${value}\n`;
    });
    csvContent += "\n";
  }

  // Section 3: Demonstrated Skills
  if (results.identifiedSkills && results.identifiedSkills.length > 0) {
    csvContent += "DEMONSTRATED SKILLS\n";
    results.identifiedSkills.forEach((s: string) => {
      csvContent += `"${s.replace(/"/g, '""')}"\n`;
    });
    csvContent += "\n";
  }

  // Section 4: Recommended Skills
  if (results.recommendedSkills && results.recommendedSkills.length > 0) {
    csvContent += "RECOMMENDED SKILLS\n";
    results.recommendedSkills.forEach((s: string) => {
      csvContent += `"${s.replace(/"/g, '""')}"\n`;
    });
    csvContent += "\n";
  }

  // Section 5: Strengths
  if (results.strengths && results.strengths.length > 0) {
    csvContent += "STRENGTHS\n";
    results.strengths.forEach((s: string) => {
      csvContent += `"${s.replace(/"/g, '""')}"\n`;
    });
    csvContent += "\n";
  }

  // Section 6: Growth Areas
  if (results.weaknesses && results.weaknesses.length > 0) {
    csvContent += "GROWTH AREAS\n";
    results.weaknesses.forEach((w: string) => {
      csvContent += `"${w.replace(/"/g, '""')}"\n`;
    });
    csvContent += "\n";
  }

  return csvContent;
}

export function buildAssessmentJSON(results: any): string {
  return JSON.stringify(results, null, 2);
}
