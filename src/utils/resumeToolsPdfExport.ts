import jsPDF from "jspdf";

/**
 * PDF export logic extracted from resume-tools.tsx. These were originally
 * closures capturing component state (fullName, jobTitle, company, user)
 * directly — converted here to plain functions that take that data as
 * parameters instead, so they have no dependency on the page component at
 * all and can be tested/reused independently.
 *
 * Note: this is a DIFFERENT export than pdfExport.ts (which builds the
 * Dashboard Summary PDF) — kept separate since they serve different
 * features with different layouts, not duplicated logic.
 */

interface NameContext {
  fullName?: string;
  jobTitle?: string;
  company?: string;
  fallbackName?: string; // e.g. `${user.firstName} ${user.lastName}`.trim()
}

// ── PDF Export: Resume ──────────────────────────────────────────────────
export function downloadResumeAsPDF(rewrite: any, ctx: NameContext) {
  const { fullName, jobTitle, company, fallbackName } = ctx;
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
  const accentColor: [number, number, number] = [124, 58, 237]; // Purple 600
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const ensureSpace = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  const addSectionHeading = (label: string) => {
    ensureSpace(14);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), margin, y);
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.line(margin, y + 2, margin + 30, y + 2);
    y += 9;
  };

  // Header band
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(fullName || fallbackName || "Optimized Resume", margin, 17);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(jobTitle ? `Tailored for: ${jobTitle}${company ? " at " + company : ""}` : "Tailored Resume — SkillSync AI", margin, 23);
  y = 38;
  doc.setTextColor(0, 0, 0);

  if (rewrite.tailoredSummary) {
    addSectionHeading("Professional Summary");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const summaryLines = doc.splitTextToSize(rewrite.tailoredSummary, contentWidth);
    ensureSpace(summaryLines.length * 5);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 5 + 8;
  }

  if (rewrite.bullets?.length > 0) {
    addSectionHeading("Experience Highlights");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    rewrite.bullets.forEach((b: any) => {
      const bulletLines = doc.splitTextToSize(`•  ${b.rewritten}`, contentWidth - 2);
      ensureSpace(bulletLines.length * 5 + 2);
      doc.text(bulletLines, margin, y);
      y += bulletLines.length * 5 + 3;
    });
    y += 4;
  }

  if (rewrite.skillsToHighlight?.length > 0) {
    addSectionHeading("Key Skills");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const skillsLines = doc.splitTextToSize(rewrite.skillsToHighlight.join("  •  "), contentWidth);
    ensureSpace(skillsLines.length * 5);
    doc.text(skillsLines, margin, y);
    y += skillsLines.length * 5 + 8;
  }

  if (rewrite.topJobKeywords?.length > 0) {
    addSectionHeading("ATS Keywords");
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(90, 90, 90);
    const kwLines = doc.splitTextToSize(rewrite.topJobKeywords.join(", "), contentWidth);
    ensureSpace(kwLines.length * 5);
    doc.text(kwLines, margin, y);
    y += kwLines.length * 5;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated with SkillSync AI", margin, 290);

  const fileName = `${(fullName || "Resume").replace(/\s+/g, "_")}_Optimized_Resume.pdf`;
  doc.save(fileName);
}

// ── PDF Export: Cover Letter ────────────────────────────────────────────
export function downloadCoverLetterAsPDF(coverLetter: any, ctx: NameContext) {
  const { fullName, company, fallbackName } = ctx;
  const doc = new jsPDF();
  const accentColor: [number, number, number] = [37, 99, 235]; // Blue 600
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 25;

  const ensureSpace = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 25;
    }
  };

  // Sender name + date
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(fullName || fallbackName || "Applicant", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), margin, y);
  y += 10;

  // Accent rule
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Subject
  if (coverLetter.subject) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    const subjLines = doc.splitTextToSize(`RE: ${coverLetter.subject}`, contentWidth);
    ensureSpace(subjLines.length * 5 + 4);
    doc.text(subjLines, margin, y);
    y += subjLines.length * 5 + 8;
  }

  // Body
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const bodyText = coverLetter.fullText || [
    coverLetter.opening,
    coverLetter.whyThisRole,
    coverLetter.whyThisCompany,
    coverLetter.proofParagraph,
    coverLetter.closing,
  ].filter(Boolean).join("\n\n");

  const paragraphs = bodyText.split(/\n+/);
  paragraphs.forEach((para: string) => {
    if (!para.trim()) return;
    const lines = doc.splitTextToSize(para.trim(), contentWidth);
    ensureSpace(lines.length * 6 + 4);
    doc.text(lines, margin, y, { lineHeightFactor: 1.5 });
    y += lines.length * 6 + 5;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated with SkillSync AI", margin, 290);

  const fileName = `${(fullName || "Applicant").replace(/\s+/g, "_")}_Cover_Letter${company ? "_" + company.replace(/\s+/g, "_") : ""}.pdf`;
  doc.save(fileName);
}
