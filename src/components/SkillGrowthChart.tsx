import { useMemo, useState } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, Award, Target, ChevronDown } from 'lucide-react';
import { Card } from './Card';
import { ScoreHistoryEntry, AssessmentResult } from '../types/profile';

interface SkillGrowthChartProps {
  history: ScoreHistoryEntry[];
  assessments?: AssessmentResult[];
}

const CATEGORIES = [
  { id: 'overall', label: 'Overall Trend' },
  { id: 'tech_literacy', label: 'Technical' },
  { id: 'soft_skills', label: 'Soft Skills' },
  { id: 'logical_thinking', label: 'Logical' },
  { id: 'problem_solving', label: 'Problem Solving' },
  { id: 'career_awareness', label: 'Leadership' }, // Mapping Career Awareness to Leadership as requested
];

export function SkillGrowthChart({ history, assessments = [] }: SkillGrowthChartProps) {
  const [activeCategory, setActiveCategory] = useState('overall');

  const chartData = useMemo(() => {
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    const fullDateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' });

    if (activeCategory === 'overall') {
      if (!history || history.length === 0) return [];
      
      // Reverse to get chronological order (oldest to newest)
      return [...history]
        .reverse()
        .map(entry => {
          const date = new Date(entry.timestamp);
          return {
            ...entry,
            formattedDate: dateFormatter.format(date),
            fullDate: fullDateFormatter.format(date),
          };
        });
    } else {
      // Filter assessments that have the selected category
      const filtered = assessments
        .filter(asmt => asmt.categoryScores && asmt.categoryScores[activeCategory] !== undefined)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(asmt => {
          const date = new Date(asmt.timestamp);
          return {
            timestamp: asmt.timestamp,
            score: asmt.categoryScores[activeCategory],
            formattedDate: dateFormatter.format(date),
            fullDate: fullDateFormatter.format(date),
          };
        });
      
      return filtered;
    }
  }, [history, assessments, activeCategory]);

  const latestScore = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData[chartData.length - 1].score;
  }, [chartData]);

  const previousScore = useMemo(() => {
    if (chartData.length < 2) return 0;
    return chartData[chartData.length - 2].score;
  }, [chartData]);

  const growth = latestScore - previousScore;

  const currentCategoryLabel = CATEGORIES.find(c => c.id === activeCategory)?.label || 'Overall';

  if ((activeCategory === 'overall' && (!history || history.length < 2)) || 
      (activeCategory !== 'overall' && chartData.length < 2)) {
    return (
      <Card id="skill-growth-empty" className="p-8 bg-bg-card border-border shadow-2xl rounded-[2rem] flex flex-col items-center justify-center text-center h-full min-h-[400px] group hover:bg-bg-primary transition-all duration-300 relative overflow-hidden">
        <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
        <div className="absolute top-4 right-8 z-20">
          <select 
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="bg-bg-primary border border-border rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-heading outline-none cursor-pointer hover:border-accent transition-all appearance-none pr-8"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-body/40">
            <ChevronDown className="h-3 w-3" />
          </div>
        </div>

        <div className="p-4 bg-accent/10 rounded-2xl text-accent mb-4 border border-accent/20">
          <Target className="h-8 w-8" />
        </div>
        <h3 className="font-display font-semibold text-text-heading uppercase tracking-tight text-xl mb-2">
          {activeCategory === 'overall' ? 'Track Your Growth' : `No ${currentCategoryLabel} Data`}
        </h3>
        <p className="text-sm font-medium text-text-body/60 max-w-[240px]">
          {activeCategory === 'overall' 
            ? 'Complete assessments and activities to see your SkillSync score trend over time.'
            : `You haven't completed enough assessments that evaluate ${currentCategoryLabel} skills yet.`}
        </p>
      </Card>
    );
  }

  return (
    <Card id="skill-growth-chart" className="p-8 bg-bg-card border-border shadow-2xl rounded-[2rem] flex flex-col h-full group hover:bg-bg-primary transition-all duration-300 overflow-hidden relative min-h-[450px]">
      <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-30" />
      <div className="absolute -top-12 -right-12 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <TrendingUp className="h-48 w-48 text-accent" />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded-2xl text-accent border border-accent/20">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-primary-purple mb-0.5">
              <span className="h-1 w-1 rounded-full bg-primary-purple animate-pulse-violet" />
              Live trend
            </span>
            <h3 className="font-display font-semibold text-text-heading uppercase tracking-widest text-xs">Growth Metrics</h3>
            <p className="font-display text-2xl font-semibold text-text-heading tracking-tight uppercase">{currentCategoryLabel} Trend</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <select 
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="bg-bg-primary border border-white/5 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-heading outline-none cursor-pointer hover:border-accent transition-all appearance-none pr-10"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-bg-card">{cat.label}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-body/40">
              <ChevronDown className="h-3 w-3" />
            </div>
          </div>
          
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-body/40">Current Score</p>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-4xl font-black text-text-heading tracking-tighter">{latestScore}</span>
              {growth !== 0 && (
                <div className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${growth > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {growth > 0 ? '+' : ''}{growth}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[300px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="formattedDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }}
              dy={10}
            />
            <YAxis 
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#111', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '12px'
              }}
              itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 800 }}
              cursor={{ stroke: 'var(--color-accent)', strokeWidth: 1 }}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              name="Score"
              stroke="var(--color-accent)" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorScore)" 
              animationBegin={0}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 flex items-center gap-2 relative z-10">
        <Award className="h-3 w-3 text-accent" />
        <p className="text-[10px] font-medium text-text-body/60 italic">
          {activeCategory === 'overall' && history.length > 0 
            ? history[0].reason 
            : `Tracking your proficiency in ${currentCategoryLabel} over time.`}
        </p>
      </div>
    </Card>
  );
}