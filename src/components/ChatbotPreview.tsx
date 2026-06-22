import { MessageCircle } from "lucide-react";

export default function ChatbotPreview() {
  return (
    <div className="fixed bottom-24 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-card border border-border shadow-2xl rounded-3xl px-5 py-4 max-w-xs">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary-blue/20 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary-blue" />
          </div>

          <div>
            <h4 className="font-bold text-text-primary text-sm">
              Hi 👋 How can I help you?
            </h4>

            <p className="text-text-secondary text-xs mt-1 leading-relaxed">
              Ask about careers, resumes, skills, or interview preparation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}