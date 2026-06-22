/**
 * sampleProfiles.ts
 *
 * Shared "Try Sample Data" content for parser.tsx and resume-tools.tsx.
 *
 * Each entry pairs a sample resume with a matching sample job posting, so
 * the demo data is internally coherent — a Marketing resume paired with a
 * Marketing job description, not a random mismatch. resume-tools.tsx needs
 * both halves (it rewrites a resume *against* a specific job description),
 * while parser.tsx only uses the resume half + targetRole.
 *
 * Roles were chosen from current fastest-growing-jobs data (LinkedIn Jobs
 * on the Rise 2026 / WEF Future of Jobs reporting): AI Engineer is one of
 * LinkedIn's fastest-growing roles three years running; Data Analyst /
 * "big data specialist" and Cybersecurity / "security management
 * specialist" both appear on WEF's fastest-growing list; "growth marketing
 * manager" appears on LinkedIn's; and sustainability roles are repeatedly
 * highlighted by WEF as part of the green-transition hiring trend. Software
 * Developer is included as a broadly-applicable, consistently high-demand
 * baseline role.
 */

export interface SampleProfile {
  id: string;
  label: string; // shown on the role-choice button, e.g. "AI Engineer"

  // Resume fields (used by both parser.tsx and resume-tools.tsx manual-entry forms)
  fullName: string;
  email: string;
  currentRole: string;
  education: string;
  experienceYears: string;
  skills: string[];
  workHistory: string;
  summary: string;
  targetRole: string; // used by parser.tsx as the job-search role

  // Matching job posting (used by resume-tools.tsx, which rewrites a resume
  // against a specific job description)
  jobTitle: string;
  company: string;
  jobDescription: string;
}

export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    id: "ai-engineer",
    label: "AI Engineer",
    fullName: "Sam Rivera",
    email: "sam.rivera@example.com",
    currentRole: "AI Engineer",
    education: "Bachelor's in Computer Science",
    experienceYears: "0-1 years",
    skills: ["Python", "n8n", "LLM Integration", "RAG", "OpenAI API", "FastAPI", "PostgreSQL", "Automation"],
    workHistory: "Built several portfolio projects involving LLM-integrated automation, including a hospital workflow assistant and an AI voice agent using Retell AI.",
    summary: "Early-career AI engineer focused on LLM-integrated automation, with hands-on experience building agentic workflows and RAG pipelines.",
    targetRole: "AI Engineer",
    jobTitle: "Junior AI Engineer",
    company: "Northwind Labs",
    jobDescription: `We're looking for a Junior AI Engineer to join our applied AI team.

Responsibilities:
- Build and maintain LLM-powered automation workflows using tools like n8n and the OpenAI API
- Design and implement RAG (retrieval-augmented generation) pipelines for internal knowledge bases
- Develop backend services in Python/FastAPI to support AI features
- Work with PostgreSQL and vector databases to store and query embeddings
- Collaborate with product and engineering teams to ship AI features end-to-end

Requirements:
- 0-2 years of experience building with LLMs, automation tools, or backend APIs
- Proficiency in Python
- Familiarity with prompt engineering and RAG concepts
- Experience with FastAPI or similar backend frameworks
- Bachelor's degree in Computer Science or related field (or equivalent experience)

Nice to have:
- Experience with workflow automation tools (n8n, Zapier, Make)
- Experience with voice AI or agentic workflows
- Familiarity with PostgreSQL or pgvector`,
  },
  {
    id: "data-analyst",
    label: "Data Analyst",
    fullName: "Jordan Lee",
    email: "jordan.lee@example.com",
    currentRole: "Data Analyst",
    education: "Bachelor's in Statistics",
    experienceYears: "1-3 years",
    skills: ["Python", "SQL", "Pandas", "Power BI", "Excel", "Data Visualization", "Statistics"],
    workHistory: "2 years analyzing sales and marketing data, building dashboards in Power BI, and writing SQL queries to extract insights for stakeholders.",
    summary: "Data analyst with a strong foundation in statistics and a focus on turning raw data into actionable business insights.",
    targetRole: "Data Analyst",
    jobTitle: "Data Analyst",
    company: "Meridian Retail Group",
    jobDescription: `Meridian Retail Group is hiring a Data Analyst to support our commercial and marketing teams.

Responsibilities:
- Write SQL queries to extract and transform data from our data warehouse
- Build and maintain dashboards in Power BI for sales, marketing, and operations stakeholders
- Use Python/Pandas for ad-hoc analysis and data cleaning
- Present findings and recommendations to non-technical stakeholders
- Identify trends and anomalies in sales and customer data

Requirements:
- 1-3 years of experience in a data analyst or similar role
- Strong SQL skills (joins, window functions, CTEs)
- Experience with Power BI or a similar BI tool
- Proficiency in Python and Pandas for data manipulation
- Bachelor's degree in Statistics, Mathematics, Economics, or related field

Nice to have:
- Experience with data warehousing concepts
- Familiarity with A/B testing and experimentation
- Excel power-user skills (pivot tables, advanced formulas)`,
  },
  {
    id: "cybersecurity-analyst",
    label: "Cybersecurity Analyst",
    fullName: "Priya Sharma",
    email: "priya.sharma@example.com",
    currentRole: "IT Support Specialist",
    education: "Bachelor's in Information Technology",
    experienceYears: "1-3 years",
    skills: ["Network Security", "SIEM", "Incident Response", "Vulnerability Assessment", "Linux", "Python", "Firewall Configuration"],
    workHistory: "2 years monitoring network traffic and responding to security alerts using SIEM tools, and conducting vulnerability scans across company infrastructure.",
    summary: "IT professional transitioning into cybersecurity, with hands-on experience in incident response, vulnerability assessment, and security monitoring tools.",
    targetRole: "Cybersecurity Analyst",
    jobTitle: "Cybersecurity Analyst",
    company: "Sentinel Systems",
    jobDescription: `Sentinel Systems is seeking a Cybersecurity Analyst to join our security operations team.

Responsibilities:
- Monitor security alerts and logs using SIEM tools to detect potential threats
- Conduct vulnerability assessments and recommend remediation steps
- Respond to and document security incidents following established playbooks
- Maintain and configure firewalls and network security controls
- Assist with security awareness training and compliance audits

Requirements:
- 1-3 years of experience in IT security, network administration, or a related field
- Familiarity with SIEM tools and incident response procedures
- Understanding of network security fundamentals (firewalls, VPNs, IDS/IPS)
- Comfortable working in Linux environments
- Bachelor's degree in IT, Computer Science, or related field

Nice to have:
- Security certifications (CompTIA Security+, CEH, or similar) — in progress is fine
- Scripting experience in Python or Bash
- Experience with vulnerability scanning tools (Nessus, Qualys)`,
  },
  {
    id: "digital-marketing-manager",
    label: "Digital Marketing Manager",
    fullName: "Casey Bennett",
    email: "casey.bennett@example.com",
    currentRole: "Marketing Specialist",
    education: "Bachelor's in Marketing",
    experienceYears: "3-5 years",
    skills: ["SEO", "Google Ads", "Meta Ads", "Marketing Analytics", "Content Strategy", "Email Marketing", "A/B Testing"],
    workHistory: "3 years running paid social and search campaigns, growing organic traffic through SEO, and reporting on campaign performance to leadership.",
    summary: "Results-driven digital marketer with experience across paid acquisition, SEO, and lifecycle marketing, focused on measurable growth.",
    targetRole: "Digital Marketing Manager",
    jobTitle: "Digital Marketing Manager",
    company: "Brightline Consumer Goods",
    jobDescription: `Brightline Consumer Goods is looking for a Digital Marketing Manager to lead our online acquisition strategy.

Responsibilities:
- Plan and manage paid acquisition campaigns across Google Ads and Meta Ads
- Own SEO strategy to grow organic search visibility and traffic
- Develop and execute email/lifecycle marketing campaigns
- Run A/B tests on landing pages and ad creative to improve conversion
- Report on campaign performance and ROI to senior leadership

Requirements:
- 3-5 years of experience in digital marketing, with hands-on paid media management
- Proven track record managing Google Ads and/or Meta Ads budgets
- Strong understanding of SEO fundamentals
- Experience with marketing analytics tools (GA4, or similar)
- Bachelor's degree in Marketing, Business, or related field

Nice to have:
- Experience with email marketing platforms (Klaviyo, Mailchimp, etc.)
- Familiarity with conversion rate optimization and A/B testing tools
- Experience marketing physical/consumer goods products`,
  },
  {
    id: "sustainability-analyst",
    label: "Sustainability Analyst",
    fullName: "Morgan Okafor",
    email: "morgan.okafor@example.com",
    currentRole: "Environmental Compliance Coordinator",
    education: "Bachelor's in Environmental Science",
    experienceYears: "1-3 years",
    skills: ["ESG Reporting", "Carbon Footprint Analysis", "Sustainability Reporting", "Data Analysis", "Excel", "Regulatory Compliance"],
    workHistory: "2 years tracking environmental compliance metrics and assisting with annual ESG (Environmental, Social, Governance) reporting for a manufacturing company.",
    summary: "Sustainability professional with a background in environmental compliance, focused on ESG reporting and helping organizations reduce their environmental footprint.",
    targetRole: "Sustainability Analyst",
    jobTitle: "Sustainability Analyst",
    company: "Verdant Industrial Partners",
    jobDescription: `Verdant Industrial Partners is hiring a Sustainability Analyst to support our ESG and carbon reduction initiatives.

Responsibilities:
- Collect and analyze data for annual ESG (Environmental, Social, Governance) reports
- Track and report on carbon footprint and emissions reduction progress
- Support regulatory compliance reporting related to environmental standards
- Identify opportunities to reduce energy use and waste across operations
- Collaborate with operations teams to implement sustainability initiatives

Requirements:
- 1-3 years of experience in sustainability, environmental compliance, or ESG reporting
- Strong data analysis skills (Excel proficiency required)
- Understanding of ESG reporting frameworks (GRI, SASB, or similar)
- Bachelor's degree in Environmental Science, Sustainability, or related field

Nice to have:
- Experience with carbon accounting/footprint analysis tools
- Familiarity with regulatory compliance in a manufacturing or industrial setting
- Project management experience for sustainability initiatives`,
  },
  {
    id: "software-developer",
    label: "Software Developer",
    fullName: "Alex Morgan",
    email: "alex.morgan@example.com",
    currentRole: "Frontend Developer",
    education: "Bachelor's in Computer Science",
    experienceYears: "1-3 years",
    skills: ["React", "TypeScript", "JavaScript", "Tailwind CSS", "REST APIs", "Git", "HTML", "CSS"],
    workHistory: "1.5 years at a startup building and maintaining a React-based dashboard product, collaborating with a small team using Agile workflows and Git-based version control.",
    summary: "Frontend developer passionate about building clean, responsive user interfaces. Comfortable working across the stack with modern JavaScript frameworks.",
    targetRole: "Software Developer",
    jobTitle: "Software Developer",
    company: "Lumen Cloud Technologies",
    jobDescription: `Lumen Cloud Technologies is looking for a Software Developer to join our product engineering team.

Responsibilities:
- Build and maintain features in our React/TypeScript-based web application
- Integrate with REST APIs and collaborate with backend engineers on API design
- Write clean, maintainable, well-tested code
- Participate in code reviews and Agile sprint planning
- Troubleshoot and resolve bugs reported by QA or customers

Requirements:
- 1-3 years of professional software development experience
- Strong proficiency in JavaScript/TypeScript and React
- Experience with REST APIs and Git-based version control
- Comfortable working in an Agile team environment
- Bachelor's degree in Computer Science or equivalent experience

Nice to have:
- Experience with Tailwind CSS or similar utility-first CSS frameworks
- Exposure to backend technologies (Node.js, databases)
- Experience writing unit/integration tests`,
  },
];
