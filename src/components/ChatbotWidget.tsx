import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2, Trash2, ThumbsUp, ThumbsDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useUser } from "../context/UserContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { Input } from "./Input";
import { api } from "../utils/api";
import { cn } from "../utils/cn";

interface Message {
  role: "user" | "bot";
  text: string;
  actionLink?: string;
  actionLabel?: string;
  feedback?: "up" | "down";
}

export function ChatbotWidget() {
  const { user, firstName } = useUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("skillsync_chatbot_dismissed");
      // Only show if not dismissed AND not currently on landing page (optional nuance)
      return dismissed !== "true";
    }
    return false;
  });
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Robust persistence check — ensures preview doesn't pop back if dismissed
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("skillsync_chatbot_dismissed");
      if (dismissed === "true" && showPreview) {
        setShowPreview(false);
      }
    }
  }, [pathname, showPreview]);
  
  useEffect(() => {
    const handleOpenChatbot = () => {
      setIsOpen(true);
      setShowPreview(false);
      localStorage.setItem("skillsync_chatbot_dismissed", "true");
    };
    window.addEventListener("open-chatbot", handleOpenChatbot);
    return () => window.removeEventListener("open-chatbot", handleOpenChatbot);
  }, []);

  const DEFAULT_MESSAGE: Message = {
    role: "bot",
    text: `🚀 Ready to level up your skills?\nSyncy is here to guide you.`,
  };

  // History/session keys are scoped per signed-in user. Guests (no uid) never
  // touch localStorage for chat data, so one guest can never see another
  // guest's (or a logged-in user's) conversation.
  const historyKey = user?.uid ? `skillsync_chatbot_history_${user.uid}` : null;
  const sessionKey = user?.uid ? `skillsync_chatbot_session_${user.uid}` : null;

  // One-time cleanup of the old, unscoped keys from before this was per-user.
  useEffect(() => {
    localStorage.removeItem("skillsync_chatbot_history");
    localStorage.removeItem("skillsync_chatbot_session");
  }, []);

  // Session ID: persisted per logged-in user, regenerated (in-memory only,
  // never stored) for guests on every mount.
  const [sessionId, setSessionId] = useState(() => {
    if (sessionKey) {
      const existing = localStorage.getItem(sessionKey);
      if (existing) return existing;
    }
    const newId = `session_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    if (sessionKey) localStorage.setItem(sessionKey, newId);
    return newId;
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    if (historyKey) {
      const saved = localStorage.getItem(historyKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse chatbot history", e);
        }
      }
    }
    return [DEFAULT_MESSAGE];
  });

  // Track the uid this component instance was rendered with, so we can
  // detect sign-out / sign-in / account switches and reset state accordingly.
  const prevUidRef = useRef<string | null | undefined>(user?.uid ?? null);

  useEffect(() => {
    const currentUid = user?.uid ?? null;
    if (prevUidRef.current === currentUid) return; // no actual change
    prevUidRef.current = currentUid;

    if (currentUid) {
      // Just signed in (or switched accounts) — load that user's own history.
      const saved = localStorage.getItem(`skillsync_chatbot_history_${currentUid}`);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch {
          setMessages([DEFAULT_MESSAGE]);
        }
      } else {
        setMessages([DEFAULT_MESSAGE]);
      }
      const existingSession = localStorage.getItem(`skillsync_chatbot_session_${currentUid}`);
      const newSession = existingSession || `session_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
      if (!existingSession) localStorage.setItem(`skillsync_chatbot_session_${currentUid}`, newSession);
      setSessionId(newSession);
    } else {
      // Signed out — never carry the previous user's (or guest's) messages over.
      setMessages([DEFAULT_MESSAGE]);
      setSessionId(`session_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`);
    }
  }, [user?.uid]);

  // Persist messages to localStorage — only for signed-in users. Guest
  // conversations stay in memory only and vanish when they leave/refresh.
  useEffect(() => {
    if (historyKey) {
      localStorage.setItem(historyKey, JSON.stringify(messages));
    }

    // Trigger an event so the dashboard can pick it up
    window.dispatchEvent(new Event("chatbot-history-updated"));
  }, [messages, historyKey]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleClearHistory = () => {
    setMessages([DEFAULT_MESSAGE]);
    if (historyKey) {
      localStorage.removeItem(historyKey);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const newUserMessage: Message = { role: "user", text: userMessage };
    
    // Add user message to history
    setMessages((prev) => {
      const updated = [...prev, newUserMessage];
      return updated.slice(-50); // Keep last 50
    });
    
    setInput("");
    setIsLoading(true);

    // Rolling window of the last few turns (not counting the message we're
    // about to send) so the bot isn't starting from scratch every reply.
    const recentHistory = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));

    // Summarize top skills + target role client-side, rather than dumping
    // the whole profile, to keep the prompt small and relevant.
    const topSkills = Array.isArray((user as any)?.skills)
      ? (user as any).skills.slice(0, 5).map((s: any) => (typeof s === "string" ? s : s?.name)).filter(Boolean)
      : undefined;
    const targetRole = (user as any)?.targetRole || undefined;

    try {
      const response = await api.chatbot({
        userId: user?.uid || "anonymous",
        message: userMessage,
        currentPage: pathname,
        userName: firstName || "User",
        userScore: user?.score || 0,
        hasSkills: !!(user?.skills && user.skills.length > 0),
        sessionId,
        history: recentHistory,
        topSkills,
        targetRole
      });

      console.log("Chatbot Response:", response);

      // Robust unwrapping of the response
      let data = response;
      if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
        data = data.data;
      }
      
      const reply = data.reply || data.message || data.text || data.output;
      const success = data.success !== undefined ? data.success : !!reply;

      if (success && reply) {
        const botReply: Message = {
          role: "bot",
          text: reply,
          actionLink: data.actionLink || data.action_link,
          actionLabel: data.actionLabel || data.action_label
        };
        setMessages((prev) => [...prev, botReply].slice(-50));
      } else {
        throw new Error(data.message || data.error || "Failed to get a valid response from the assistant.");
      }
    } catch (err) {
      console.error("Chatbot Error:", err);
      const errorMessage: Message = {
        role: "bot",
        text: "Sorry, I couldn't connect right now. Please try again in a moment."
      };
      setMessages((prev) => [...prev, errorMessage].slice(-50));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[calc(100vw-48px)] sm:w-[450px] h-[650px] max-h-[calc(100vh-140px)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border bg-primary-blue/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-blue flex items-center justify-center text-white">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="font-display font-semibold text-text-primary">Syncy</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearHistory}
                  title="Clear conversation"
                  className="p-1 rounded-md hover:bg-border/50 text-text-secondary hover:text-danger transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md hover:bg-border/50 text-text-secondary transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Message List */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.map((msg, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div 
                    className={cn(
                      "p-3 rounded-2xl text-sm",
                      msg.role === "user" 
                        ? "bg-primary-blue text-white rounded-tr-none shadow-md" 
                        : "bg-border text-text-primary rounded-tl-none"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                  
                  {msg.role === "bot" && (
                    <div className="flex items-center gap-2 mt-1">
                      {msg.actionLink && msg.actionLabel && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 border-primary-blue/30 text-primary-blue hover:bg-primary-blue/5"
                          onClick={() => navigate(msg.actionLink!)}
                        >
                          {msg.actionLabel}
                        </Button>
                      )}
                      {idx > 0 && (
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => {
                              const newMessages = [...messages];
                              newMessages[idx].feedback = newMessages[idx].feedback === "up" ? undefined : "up";
                              setMessages(newMessages);
                            }}
                            className={cn(
                              "p-1.5 rounded-md hover:bg-border/50 text-text-secondary transition-colors",
                              msg.feedback === "up" && "text-success bg-success/10"
                            )}
                            title="Helpful"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              const newMessages = [...messages];
                              newMessages[idx].feedback = newMessages[idx].feedback === "down" ? undefined : "down";
                              setMessages(newMessages);
                            }}
                            className={cn(
                              "p-1.5 rounded-md hover:bg-border/50 text-text-secondary transition-colors",
                              msg.feedback === "down" && "text-danger bg-danger/10"
                            )}
                            title="Not helpful"
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="max-w-[85%] mr-auto">
                  <div className="bg-border p-3 rounded-2xl rounded-tl-none flex items-center gap-1.5 h-10">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }} 
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-1.5 h-1.5 bg-text-secondary rounded-full" 
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }} 
                      transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                      className="w-1.5 h-1.5 bg-text-secondary rounded-full" 
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }} 
                      transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                      className="w-1.5 h-1.5 bg-text-secondary rounded-full" 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border bg-background">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type a message..."
                  disabled={isLoading}
                  className="bg-card"
                />
                <Button 
                  size="icon" 
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="bg-primary-blue shrink-0"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && showPreview && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: [0, -8, 0],
              scale: 1 
            }}
            transition={{
              y: {
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut"
              }
            }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-4 relative bg-card border border-border shadow-2xl p-4 rounded-2xl max-w-[280px] cursor-pointer group"
            onClick={() => {
              setIsOpen(true);
              setShowPreview(false);
              localStorage.setItem("skillsync_chatbot_dismissed", "true");
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(false);
                localStorage.setItem("skillsync_chatbot_dismissed", "true");
              }}
              className="absolute top-2 right-2 p-1 text-text-secondary hover:bg-border/50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary-blue/20 flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 text-primary-blue" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary pr-2 leading-relaxed">
                  Need career guidance, learning help, or interview prep? <span className="font-bold text-primary-blue">Ask Syncy</span>
                </p>
              </div>
            </div>
            {/* Triangle pointer */}
            <div className="absolute -bottom-2 right-5 w-4 h-4 bg-card border-b border-r border-border rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={!isOpen ? {
          y: [0, -8, 0],
        } : {
          y: 0
        }}
        transition={{
          y: {
            repeat: !isOpen ? Infinity : 0,
            duration: 3,
            ease: "easeInOut"
          }
        }}
      >
        <Button
          size="icon"
          onClick={() => {
            setIsOpen(!isOpen);
            setShowPreview(false);
            localStorage.setItem("skillsync_chatbot_dismissed", "true");
          }}
          className="h-16 w-16 rounded-full bg-primary-blue shadow-lg hover:scale-110 transition-all flex items-center justify-center cursor-pointer"
        >
          <MessageSquare className="h-7 w-7 text-white" />
        </Button>
      </motion.div>
    </div>
  );
}