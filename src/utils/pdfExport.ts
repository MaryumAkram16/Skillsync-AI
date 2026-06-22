import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportDashboardPDF(user: any) {
  if (!user) return;
  const doc = new jsPDF();
  
  const isDark = typeof window !== "undefined" && window.document.documentElement.classList.contains("dark");
  
  const primaryColor: [number, number, number] = isDark ? [15, 23, 42] : [109, 40, 217]; // Slate 900 vs Violet 700
  const accentColor: [number, number, number] = isDark ? [6, 182, 212] : [8, 145, 178]; // Cyan 500 vs Cyan 600
  const pageBg: [number, number, number] = isDark ? [11, 11, 20] : [255, 255, 255];
  const textColor: [number, number, number] = isDark ? [241, 245, 249] : [30, 27, 75];
  const subtextColor: [number, number, number] = isDark ? [148, 163, 184] : [75, 85, 99];

  const drawPageBackground = (pDoc: jsPDF) => {
    pDoc.setFillColor(pageBg[0], pageBg[1], pageBg[2]);
    pDoc.rect(0, 0, 210, 297, "F");
  };

  // Draw background for first page
  drawPageBackground(doc);

  // Header section
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Career Dashboard Summary", 14, 20);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(`Candidate: ${user.firstName || ''} ${user.lastName || ''}`, 14, 30);
  
  doc.setTextColor(subtextColor[0], subtextColor[1], subtextColor[2]);
  doc.setFontSize(11);
  doc.text(`Email: ${user.email || 'N/A'}`, 14, 38);
  doc.text(`Current Target Role: ${user.role || 'Unspecified'}`, 14, 44);
  doc.text(`Experience: ${user.experience || 'Not Specified'}`, 14, 50);
  doc.text(`SkillScore: ${user.score || user.skillSyncScore?.total || 0}`, 14, 56);
  doc.text(`Report Generated: ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 62);
  
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(14, 66, 196, 66);
  
  let currentY = 74;
  
  // Verified Skills Section
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Verified Skills", 14, currentY);
  currentY += 8;
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const skills = user.skills?.length > 0 ? user.skills.join(", ") : "No skills verified yet.";
  const splitSkills = doc.splitTextToSize(skills, 180);
  doc.text(splitSkills, 14, currentY);
  currentY += splitSkills.length * 6 + 10;
  
  // Learning Path
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Learning Pathways", 14, currentY);
  currentY += 8;
  
  const learningPath = user.learningPath || [];
  if (learningPath.length > 0) {
    const tableData = learningPath.map((item: any) => [item.skill || item.skillName || item.title || 'Unknown', item.status || "Planned"]);
    autoTable(doc, {
      startY: currentY,
      head: [['Module / Skill', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
      bodyStyles: isDark ? { fillColor: [30, 30, 58], textColor: textColor } : { textColor: textColor },
      alternateRowStyles: isDark ? { fillColor: [40, 40, 70] } : undefined,
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;
  } else {
    doc.setTextColor(subtextColor[0], subtextColor[1], subtextColor[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.text("No dynamic learning paths scheduled currently.", 14, currentY);
    currentY += 12;
  }
  
  // Action Items
  const savedTasks = user.actionItems || [];
  if (savedTasks.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      drawPageBackground(doc);
      currentY = 20;
    }
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Action Items & Tasks", 14, currentY);
    currentY += 8;
    
    const taskData = savedTasks.map((t: any) => [t.text, t.completed ? "Done" : "Pending"]);
    autoTable(doc, {
      startY: currentY,
      head: [['Task Description', 'Status']],
      body: taskData,
      theme: isDark ? 'grid' : 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
      bodyStyles: isDark ? { fillColor: [30, 30, 58], textColor: textColor } : { textColor: textColor },
      alternateRowStyles: isDark ? { fillColor: [40, 40, 70] } : undefined,
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Saved Reports Summary
  const results: any[] = [];
  if (user.savedAssessments?.length) results.push(["Skill Assessment", `Overall Score: ${user.savedAssessments[0].score}/100`, new Date(user.savedAssessments[0].timestamp).toLocaleDateString()]);
  if (user.savedCareerReports?.length) results.push(["Career Report", user.savedCareerReports[0].title || "Recommended Roles", new Date(user.savedCareerReports[0].timestamp).toLocaleDateString()]);
  if (user.savedRoadmaps?.length) results.push(["Roadmap", user.savedRoadmaps[0].title || "Dynamic Roadmap", new Date(user.savedRoadmaps[0].timestamp).toLocaleDateString()]);
  if (user.savedGapAnalyses?.length) results.push(["Gap Analysis", `Scanned: ${user.savedGapAnalyses[0].skills?.length || 0} Target Skills`, new Date(user.savedGapAnalyses[0].timestamp).toLocaleDateString()]);

  if (results.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      drawPageBackground(doc);
      currentY = 20;
    }
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Saved Reports & Assessments", 14, currentY);
    currentY += 8;

    autoTable(doc, {
      startY: currentY,
      head: [['Report Type', 'Details / Title', 'Saved Date']],
      body: results,
      theme: isDark ? 'grid' : 'plain',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
      bodyStyles: isDark ? { fillColor: [30, 30, 58], textColor: textColor } : { textColor: textColor },
      alternateRowStyles: isDark ? { fillColor: [40, 40, 70] } : undefined,
    });
  }
  
  // Footer page numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(subtextColor[0], subtextColor[1], subtextColor[2]);
    doc.text(`Page ${i} of ${totalPages}`, 95, 287);
    doc.text("Generated by SkillSync AI Talent Dashboard", 14, 287);
  }
  
  doc.save(`Activity_Summary_${user.firstName || 'User'}_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportRoadmapPDF(roadmap: any, user: any) {
  if (!roadmap) return;
  const doc = new jsPDF();
  
  const isDark = typeof window !== "undefined" && window.document.documentElement.classList.contains("dark");

  const primaryColor: [number, number, number] = isDark ? [15, 23, 42] : [109, 40, 217]; // Slate 900 vs Violet 700
  const accentColor: [number, number, number] = isDark ? [6, 182, 212] : [8, 145, 178]; // Cyan 500 vs Cyan 600
  const secondaryColor: [number, number, number] = isDark ? [124, 58, 237] : [99, 102, 241]; // Violet 500 vs Indigo 500
  const pageBg: [number, number, number] = isDark ? [11, 11, 20] : [255, 255, 255];
  const textColor: [number, number, number] = isDark ? [241, 245, 249] : [30, 27, 75];
  const subtextColor: [number, number, number] = isDark ? [148, 163, 184] : [75, 85, 99];

  const drawPageBackground = (pDoc: jsPDF) => {
    pDoc.setFillColor(pageBg[0], pageBg[1], pageBg[2]);
    pDoc.rect(0, 0, 210, 297, "F");
  };

  // Draw background for first page
  drawPageBackground(doc);

  // Page 1: Elegant Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SkillSync — Dynamic Career Roadmap", 15, 25);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const candidateName = user ? `${user.firstName || ''} ${user.lastName || 'User'}`.trim() : 'Validated Candidate';
  doc.text(`Generated on ${new Date().toLocaleDateString()} for ${candidateName}`, 15, 33);

  // Roadmap General Header details
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(roadmap.title || "Career Path", 15, 55);

  let currentY = 62;

  if (roadmap.summary) {
    const summaryText = typeof roadmap.summary === 'string' ? roadmap.summary : '';
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const splitSummary = doc.splitTextToSize(summaryText, 180);
    doc.text(splitSummary, 15, currentY);
    // Draw a subtle left accent line for the summary quote
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineWidth(1);
    doc.line(12, currentY - 2, 12, currentY - 2 + (splitSummary.length * 4.5));
    currentY += (splitSummary.length * 4.5) + 15;
  } else {
    currentY += 10;
  }

  // General Attributes Table
  const metadataRows = [
    ["Target Goal", roadmap.goal || roadmap.title || "Target Career Path"],
    ["Total Prep Time", roadmap.total_duration || "Self-Paced"],
    ["Weekly Intensity", roadmap.weekly_hours ? `${roadmap.weekly_hours} Hours/Week` : "Flexible"],
    ["Projected Salary Range", roadmap.salary_range || "Competitive / Dynamic Market Rate"],
  ];

  if (roadmap.job_titles && Array.isArray(roadmap.job_titles) && roadmap.job_titles.length > 0) {
    metadataRows.push(["Related Job Titles", roadmap.job_titles.join(", ")]);
  }

  if (roadmap.prerequisites && Array.isArray(roadmap.prerequisites) && roadmap.prerequisites.length > 0) {
    metadataRows.push(["Prerequisites Needed", roadmap.prerequisites.join(", ")]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [["Overview Property", "Details / Benchmarks"]],
    body: metadataRows,
    theme: isDark ? "grid" : "striped",
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
    bodyStyles: isDark ? { fillColor: [30, 30, 58], textColor: textColor } : { textColor: textColor },
    alternateRowStyles: isDark ? { fillColor: [40, 40, 70] } : undefined,
    styles: { fontSize: 10 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Render Phases sequentially using autotables to support automatic page breaks flawlessly.
  if (roadmap.phases && Array.isArray(roadmap.phases)) {
    roadmap.phases.forEach((phase: any, index: number) => {
      // Check if we need to start a new page
      if (currentY > 230) {
        doc.addPage();
        drawPageBackground(doc);
        currentY = 20;
      }

      // Phase Header line
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Module ${index + 1}: ${phase.name || `Phase ${index + 1}`}`, 15, currentY);
      
      // Draw standard accent divider
      doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setLineWidth(1.5);
      doc.line(15, currentY + 2, 80, currentY + 2);

      // Phase Meta Subtext: Duration & Weekly intensity
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      const metaText = `Duration: ${phase.duration || "Flexible"}  |  Weekly Hours: ${phase.weekly_hours || roadmap.weekly_hours || "Flexible"}`;
      doc.text(metaText, 15, currentY + 8);

      currentY += 12;

      // Topics in Phase
      const topicsRows: any[] = [];
      const topics = phase.topics || [];
      
      topics.forEach((topic: any) => {
        let subList = "";
        if (Array.isArray(topic.subtopics)) {
          subList = topic.subtopics.map((s: any) => {
            if (typeof s === 'string') return `• ${s}`;
            return `• ${s.name || JSON.stringify(s)}`;
          }).join("\n");
        }
        topicsRows.push([
          topic.name || "Core Skill",
          subList || "Standard dynamic curriculum topics"
        ]);
      });

      if (topicsRows.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: [["Subject Topic", "Detailed Subtopics & Concepts Checklist"]],
          body: topicsRows,
          theme: "grid",
          headStyles: { fillColor: accentColor, textColor: [255, 255, 255] },
          bodyStyles: isDark ? { fillColor: [30, 30, 58], textColor: textColor } : { textColor: textColor },
          alternateRowStyles: isDark ? { fillColor: [40, 40, 70] } : undefined,
          styles: { fontSize: 9, cellPadding: 4 },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 55 },
            1: { fontStyle: "normal" }
          }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(subtextColor[0], subtextColor[1], subtextColor[2]);
        doc.text("Self-guided practice and project development", 15, currentY);
        currentY += 15;
      }
    });
  }

  // Add numbering to all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(subtextColor[0], subtextColor[1], subtextColor[2]);
    doc.text(`Page ${i} of ${totalPages}`, 95, 287);
    doc.text("Generated by SkillSync AI Learning Platform", 15, 287);
  }

  // Trigger Save with elegant filename
  const cleanTitle = (roadmap.title || "Career_Roadmap").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`skillsync_roadmap_${cleanTitle}.pdf`);
}
