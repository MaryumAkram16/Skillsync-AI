const data = {
  uid: "4rUfnJvHcLWLu8Vi08qQDLEJaGg2",
  firstName: "Ai",
  lastName: "Career",
  email: "aicareer66@gmail.com",
  photoURL: "https://lh3.googleusercontent.com/a/ACg8ocIdf2gRjokyRnWtsOgx0-1k0TrnCh9RO83IqJFgMWUa2GRExg=s96-c",
  role: "Job Seeker",
  location: "Not specified",
  experience: "Entry Level",
  score: 0,
  tier: "Free",
  createdAt: new Date().toISOString(),
  isAdmin: false,
  savedAssessments: [],
  savedCareerReports: [],
  savedRoadmaps: [],
  savedRadarAnalyses: [],
  savedResumeItems: [],
  savedGapAnalyses: [],
  savedInterviewSessions: [],
  skillSyncScore: {
    total: 0,
    categories: {
      assessment: 0, careerMentor: 0, roadmap: 0,
      radar: 0, resume: 0, gapMap: 0, interview: 0
    }
  },
  scoreHistory: []
};

const allowedFields = [
  'uid', 'firstName', 'lastName', 'email', 'photoURL', 'role', 'location', 
  'experience', 'score', 'tier', 'createdAt', 'skills', 
  'learningPath', 'completedResources', 'actionItems',
  'savedAssessments', 'savedCareerReports', 'savedRoadmaps', 
  'savedRadarAnalyses', 'savedResumeItems', 'savedGapAnalyses', 
  'savedInterviewSessions', 'skillSyncScore', 'scoreHistory',
  'isAdmin', 'lastActive', 'fieldOfStudy'
];

const keys = Object.keys(data);
const hasOnlyAllowedFields = keys.every(key => allowedFields.includes(key));
console.log("hasOnlyAllowedFields:", hasOnlyAllowedFields);
if (!hasOnlyAllowedFields) {
  console.log("Violating keys:", keys.filter(key => !allowedFields.includes(key)));
}

const requiredFields = ['uid', 'firstName', 'lastName', 'email', 'tier'];
const hasRequiredFields = requiredFields.every(key => keys.includes(key));
console.log("hasRequiredFields:", hasRequiredFields);
