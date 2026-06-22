import React from "react";
import { Card } from "../Card";
import { Calendar, Activity } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { cn } from "../../lib/utils";

interface ActivityFeedProps {
  user: any;
  scoreData: any[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ user, scoreData }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Score Chart */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-8 border border-border bg-card divide-y divide-white/5">
          <div className="pb-8">
             <h3 className="font-display text-xl font-semibold text-text-primary uppercase tracking-tight mb-2">Talent Progression</h3>
             <p className="text-sm text-text-secondary">Visualize your skill growth and engagement history</p>
          </div>
          <div className="pt-8 h-[400px] w-full">
            {scoreData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                <AreaChart data={scoreData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#ffffff20" 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#ffffff20" 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-12">
                <p className="text-text-secondary/60 italic">Need at least 2 data points to visualize your growth chart.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="p-8 border border-border bg-card">
        <h3 className="font-display text-xl font-semibold text-text-primary uppercase tracking-tight mb-8">Activity Feed</h3>
        <div className="space-y-10 relative">
          {/* Vertical Line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-background" />
          
          {user.scoreHistory && user.scoreHistory.length > 0 ? (
            user.scoreHistory.map((history: any, i: number) => (
              <div key={i} className="relative pl-10 flex flex-col gap-1">
                <div className={cn(
                  "absolute left-0 top-1 w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-text-primary font-bold text-[10px]",
                  history.change >= 0 ? "bg-success" : "bg-danger"
                )}>
                  {history.change > 0 ? `+${history.change}` : history.change}
                </div>
                <p className="font-display font-semibold text-text-primary text-xs uppercase tracking-tight">{history.reason}</p>
                <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                  <Calendar className="h-3 w-3" />
                  {new Date(history.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-text-secondary/60 italic">No activity recorded yet.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};