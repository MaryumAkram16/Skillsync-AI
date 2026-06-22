import { Navbar } from "../components/Navbar";
import { Card } from "../components/Card";

const lastUpdated = "June 21, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary-blue/30 font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-secondary mb-10">Last updated: {lastUpdated}</p>

        <Card className="p-6 sm:p-8 space-y-8 leading-relaxed text-sm sm:text-base text-text-secondary">
          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">1. What this policy covers</h2>
            <p>
              This Privacy Policy explains what information SkillSync AI ("SkillSync", "we", "us") collects when you
              use our website and application, how we use it, who we share it with, and the choices you have. By
              using SkillSync, you agree to the practices described here.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">2. Information we collect</h2>
            <p className="mb-3"><strong className="text-text-primary">Account information.</strong> When you sign in with Google or create an account with
              email and password, we receive your name, email address, and (if you sign in with Google) your profile
              photo. Authentication is handled by Firebase Authentication.</p>
            <p className="mb-3"><strong className="text-text-primary">Resume and career content.</strong> If you upload a resume or fill out forms in
              the Parser, GapMap, Career Mentor, Roadmap, Interview Prep, Resume Tools, or Skill Assessment features,
              we process the text you provide (work history, skills, education, target role, etc.) to generate
              results for you.</p>
            <p className="mb-3"><strong className="text-text-primary">Usage and saved results.</strong> We store the results you generate (e.g. saved
              radar analyses, roadmaps, interview sessions, gap analyses) in your account so you can return to them
              later, along with basic usage metadata (timestamps, feature usage counts) used to track your progress
              and enforce usage limits.</p>
            <p><strong className="text-text-primary">Chatbot conversations.</strong> Messages you send to the Syncy AI assistant are stored locally
              in your browser and, if you're signed in, scoped to your account so they don't mix with anyone else's.
              Guest (signed-out) conversations are never saved to a server and disappear when you leave the page.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">3. How we use your information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To generate the analyses, recommendations, and content you explicitly request from each feature.</li>
              <li>To save your results and progress so you can pick up where you left off.</li>
              <li>To personalize chatbot responses using your own skills, target role, and assessment status.</li>
              <li>To operate, maintain, secure, and improve the service.</li>
              <li>To communicate with you about your account or respond to support/feedback requests.</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information, and we do not use your resume content to train our own models.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">4. Third parties we share data with</h2>
            <p className="mb-3">
              To provide our features, certain content is sent to the following third-party processors. Each
              receives only what's needed to perform its specific task — for example, your resume text is sent to an
              AI provider to generate a skills analysis, not to a job-search API.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-text-primary">OpenAI</strong> and <strong className="text-text-primary">Google Gemini</strong> — process text you submit (resume content,
                career goals, chatbot messages) to generate AI-powered analysis, recommendations, and chat replies.</li>
              <li><strong className="text-text-primary">Google Firebase</strong> (Authentication, Firestore, Hosting) — handles sign-in and stores your
                account data and saved results.</li>
              <li><strong className="text-text-primary">RapidAPI / JSearch</strong> and <strong className="text-text-primary">SerpAPI</strong> — used to fetch live, publicly
                listed job postings for Radar and Parser. We send search terms (e.g. a role and location), not your
                personal resume content.</li>
              <li><strong className="text-text-primary">YouTube Data API</strong> — used to surface relevant learning resources in Roadmap.</li>
            </ul>
            <p className="mt-3">
              These providers process data under their own privacy policies and may process it outside your country
              of residence. We do not otherwise sell, rent, or share your personal data with advertisers or data
              brokers.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">5. Data retention and deletion</h2>
            <p>
              We retain your account data and saved results for as long as your account is active. You can delete
              individual saved items from within the app, or request full account deletion at any time by contacting
              us at the email below — we will delete your account data within 30 days of a verified request, except
              where we're required to retain it for legal or security reasons.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">6. Your choices and rights</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You can review, edit, or delete your saved results from within your account at any time.</li>
              <li>You can sign out at any time, which clears locally stored chatbot history.</li>
              <li>Depending on where you live, you may have rights to access, correct, export, or delete your
                personal data, and to object to certain processing. Contact us to exercise these rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">7. Security</h2>
            <p>
              We use industry-standard measures (including Firebase's built-in security infrastructure) to protect
              your data in transit and at rest. No system is perfectly secure, and we can't guarantee absolute
              security, but we work to keep your information protected and only retain what's needed to run the
              service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">8. Children's privacy</h2>
            <p>
              SkillSync is not directed at children under 13, and we do not knowingly collect personal information
              from children under 13. If you believe a child has provided us with personal information, please
              contact us so we can remove it.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">9. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we'll update the
              "Last updated" date above and, where appropriate, notify you in-app.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">10. Contact us</h2>
            <p>
              Questions about this policy or your data? Email us at{" "}
              <a href="mailto:projectsa241@gmail.com" className="text-primary-blue hover:underline">
                projectsa241@gmail.com
              </a>.
            </p>
          </section>
        </Card>
      </main>
    </div>
  );
}
