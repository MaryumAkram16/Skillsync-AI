import { Link, useLocation } from "react-router-dom";
import { cn } from "../utils/cn";
import { 
  LayoutDashboard, 
  Radar, 
  FileText, 
  Map, 
  Compass,
  User, 
  LogOut,
  BrainCircuit,
  Moon,
  Sun,
  MessageSquare,
  X,
  ShieldCheck, // <-- ADDED for admin icon
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useUser } from "../context/UserContext";

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Skill Assessment", path: "/skill-assessment", icon: BrainCircuit },
  { name: "Career Mentor", path: "/career-mentor", icon: Compass },
  { name: "Radar", path: "/radar", icon: Radar },
  { name: "Parser", path: "/parser", icon: FileText },
  { name: "Resume Tools", path: "/resume-tools", icon: FileText },
  { name: "GapMap", path: "/gapmap", icon: Map },
  { name: "Roadmap", path: "/roadmap", icon: Compass },
  { name: "Interview Preparation", path: "/interview", icon: MessageSquare },
  { name: "Profile", path: "/profile", icon: User },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { logout, isAdmin } = useUser(); // <-- added isAdmin

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-6">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <BrainCircuit className="h-8 w-8 text-primary-blue" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary-blue to-primary-purple bg-clip-text text-transparent">
            SkillSync AI
          </span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-text-secondary hover:bg-border/50 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={onClose}
                data-tour={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors group",
                  isActive 
                    ? "bg-primary-blue/10 text-primary-blue" 
                    : "text-text-secondary hover:bg-border/50 hover:text-text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}

          {/* Admin Panel link — only visible to admins */}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mt-2 border-t border-border pt-3",
                location.pathname === '/admin'
                  ? "bg-primary-blue/10 text-primary-blue"
                  : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
              )}
            >
              <ShieldCheck className="h-5 w-5" />
              Admin Panel
            </Link>
          )}
        </nav>
      </div>

      <div className="border-t border-border p-4 space-y-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-border/50 hover:text-text-primary cursor-pointer"
        >
          {theme === "dark" ? (
            <>
              <Sun className="h-5 w-5 text-amber-500" />
              Light Mode
            </>
          ) : (
            <>
              <Moon className="h-5 w-5 text-slate-700" />
              Dark Mode
            </>
          )}
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-border/50 hover:text-text-primary cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
        <div className="flex justify-center gap-2.5 pt-2 text-[10px] text-text-secondary/60 border-t border-white/5 mt-1 select-none">
          <Link to="/terms-of-service" className="hover:text-text-primary hover:underline transition-colors">
            Terms
          </Link>
          <span>•</span>
          <Link to="/privacy-policy" className="hover:text-text-primary hover:underline transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </aside>
  );
}