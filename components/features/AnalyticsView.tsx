
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../ui';
import { Task, UserStory, Milestone, Team, User } from '../../types';
import { 
  Timer, Zap, History, TrendingUp, Activity, AlertTriangle, 
  Sparkles, BrainCircuit, Users, Target, Loader2, 
  Award, ShieldCheck, MessageSquare, CheckCircle2, Flame,
  Clock, BarChart
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';

// --- Visual Components ---

const RadarChart = ({ data, size = 300 }: { data: { label: string; value: number }[]; size?: number }) => {
  const center = size / 2;
  const radius = size * 0.4;
  const angleStep = (Math.PI * 2) / data.length;

  // Generate points for the polygon
  const points = data.map((d, i) => {
    const r = (d.value / 100) * radius;
    const x = center + r * Math.cos(i * angleStep - Math.PI / 2);
    const y = center + r * Math.sin(i * angleStep - Math.PI / 2);
    return `${x},${y}`;
  }).join(' ');

  // Generate background web
  const webLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="relative flex items-center justify-center bg-white p-4 rounded-xl border shadow-sm overflow-hidden group">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Web */}
        {webLevels.map((level) => (
          <polygon
            key={level}
            points={data.map((_, i) => {
              const r = level * radius;
              const x = center + r * Math.cos(i * angleStep - Math.PI / 2);
              const y = center + r * Math.sin(i * angleStep - Math.PI / 2);
              return `${x},${y}`;
            }).join(' ')}
            className="fill-none stroke-slate-100"
            strokeWidth="1"
          />
        ))}
        {/* Axes */}
        {data.map((_, i) => {
          const x = center + radius * Math.cos(i * angleStep - Math.PI / 2);
          const y = center + radius * Math.sin(i * angleStep - Math.PI / 2);
          return (
            <line key={i} x1={center} y1={center} x2={x} y2={y} className="stroke-slate-100" />
          );
        })}
        {/* Data Shape */}
        <polygon
          points={points}
          className="fill-primary/20 stroke-primary transition-all duration-700 ease-out"
          strokeWidth="3"
        />
        {/* Labels */}
        {data.map((d, i) => {
          const x = center + (radius + 20) * Math.cos(i * angleStep - Math.PI / 2);
          const y = center + (radius + 20) * Math.sin(i * angleStep - Math.PI / 2);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              className="text-[10px] font-bold fill-slate-500 uppercase tracking-tighter"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
      <div className="absolute top-2 left-2 flex flex-col gap-1">
         <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">TEAM RADAR</span>
      </div>
    </div>
  );
};

const HealthRing = ({ progress, size = 80, strokeWidth = 8, color = "#2563eb", label = "" }: { progress: number; size?: number; strokeWidth?: number; color?: string; label: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-in-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold">{Math.round(progress)}%</span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
    </div>
  );
};

// --- Helpers ---

const formatDuration = (ms: number) => {
  if (isNaN(ms) || ms <= 0) return "N/A";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(ms / (1000 * 60))}m`;
};

const cleanJson = (text: string) => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return match[1];
  return text.trim();
};

interface AiKpis {
  complexityScore: number;
  collaborationScore: number;
  predictabilityScore: number;
  summary: string;
}

export const AnalyticsView = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiKpis, setAiKpis] = useState<AiKpis | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [taskSnap, msSnap, teamSnap, userSnap] = await Promise.all([
        getDocs(collection(db, "tasks")),
        getDocs(collection(db, "milestones")),
        getDocs(collection(db, "teams")),
        getDocs(collection(db, "users"))
      ]);

      const loadedTasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(loadedTasks);
      setMilestones(msSnap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));
      setTeams(teamSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
      setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));

      const blSnap = await getDocs(collection(db, "product_backlogs"));
      const storyPromises = blSnap.docs.map(async (bl) => {
        const snap = await getDocs(collection(db, `product_backlogs/${bl.id}/user_stories`));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserStory));
      });
      const storiesArrays = await Promise.all(storyPromises);
      setStories(storiesArrays.flat());
    } catch (e) {
      console.error("Error fetching analytics data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- KPI & Data Processing ---

  const metrics = useMemo(() => {
    if (loading) return null;

    // Cycle Time
    const doneTasks = tasks.filter(t => t.status === 'Done' && t.startTime && t.endTime);
    const avgCycleTime = doneTasks.length > 0 
      ? doneTasks.reduce((acc, t) => acc + (t.endTime! - t.startTime!), 0) / doneTasks.length 
      : 0;

    // Fix: Defined weeklyThroughput to fix the "Cannot find name 'weeklyThroughput'" error.
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const weeklyThroughput = tasks.filter(t => t.status === 'Done' && t.endTime && t.endTime > oneWeekAgo).length;

    // Velocity
    const completedStories = stories.filter(s => {
      const storyTasks = tasks.filter(t => t.userStoryId === s.id);
      return storyTasks.length > 0 && storyTasks.every(t => t.status === 'Done');
    });

    const avgLeadTime = completedStories.length > 0
      ? completedStories.reduce((acc, s) => {
          const storyTasks = tasks.filter(t => t.userStoryId === s.id);
          const lastTaskDone = Math.max(...storyTasks.map(t => t.endTime || 0));
          const startTime = s.createdAt || Math.min(...storyTasks.map(t => t.createdAt));
          return acc + (lastTaskDone - startTime);
        }, 0) / completedStories.length
      : 0;

    // Radar Chart Logic (Aggregated for all teams)
    const speed = Math.min(100, Math.max(20, 100 - (avgCycleTime / (1000 * 60 * 60 * 24 * 7)) * 50)); // Target 1 week avg
    const estimation = aiKpis?.predictabilityScore || 70;
    const collaboration = aiKpis?.collaborationScore || 65;
    
    // Stability: Lack of status regressions
    const stability = 100 - Math.min(50, tasks.reduce((acc, t) => acc + (t.history?.length || 0), 0) / (tasks.length || 1) * 5);
    
    // Completion: Subtask completion rate
    const totalSubs = tasks.reduce((acc, t) => acc + (t.subtasks?.length || 0), 0);
    const doneSubs = tasks.reduce((acc, t) => acc + (t.subtasks?.filter(s => s.isDone).length || 0), 0);
    const completion = totalSubs > 0 ? (doneSubs / totalSubs) * 100 : 0;

    const radarData = [
      { label: 'Speed', value: speed },
      { label: 'Estimation', value: estimation },
      { label: 'Comments', value: collaboration },
      { label: 'Stability', value: stability },
      { label: 'Subtasks', value: completion },
    ];

    // Health Rings for Active Milestone
    const activeMilestone = milestones.find(m => m.status === 'Active') || milestones[0];
    let healthRings = { progress: 0, time: 0, quality: 0 };
    
    if (activeMilestone) {
        const mTasks = tasks.filter(t => t.milestoneId === activeMilestone.id || stories.find(s => s.id === t.userStoryId)?.backlogId === activeMilestone.id); // Loose mapping
        const doneInM = mTasks.filter(t => t.status === 'Done').length;
        healthRings.progress = mTasks.length > 0 ? (doneInM / mTasks.length) * 100 : 0;
        
        const start = new Date(activeMilestone.startDate).getTime();
        const end = new Date(activeMilestone.endDate).getTime();
        const now = Date.now();
        healthRings.time = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
        
        // Quality: Low Testing overhead
        const testingInM = mTasks.filter(t => t.status === 'Testing' || t.status === 'Review').length;
        healthRings.quality = mTasks.length > 0 ? Math.max(0, 100 - (testingInM / mTasks.length) * 100) : 100;
    }

    // Gamification Badges
    const badges = [];
    if (estimation > 85) badges.push({ id: 'est', title: 'Estimator Master', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'تخمین‌های فوق‌العاده دقیق' });
    if (doneTasks.length > 20) badges.push({ id: 'cls', title: 'Heavy Closer', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'بیش از ۲۰ تسک نهایی شده' });
    if (collaboration > 80) badges.push({ id: 'lia', title: 'Great Liaison', icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50', desc: 'تعامل تیمی مثال‌زدنی' });
    if (stability > 90) badges.push({ id: 'stb', title: 'Stable Ship', icon: CheckCircle2, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'کمترین نرخ بازگشت تسک' });
    if (weeklyThroughput > 10) badges.push({ id: 'flm', title: 'On Fire', icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50', desc: 'سرعت تسویه تسک بسیار بالا' });

    return { radarData, healthRings, avgCycleTime, avgLeadTime, weeklyThroughput, badges, activeMilestone };
  }, [loading, tasks, stories, milestones, aiKpis]);

  const generateAiAudit = async () => {
    setAiLoading(true);
    try {
      const projectSummary = tasks.map(t => {
        const story = stories.find(s => s.id === t.userStoryId);
        return {
          title: t.title,
          points: story?.points || 0,
          subtasksCount: t.subtasks?.length || 0,
          commentsCount: t.comments?.length || 0,
          status: t.status,
          duration: t.endTime && t.startTime ? t.endTime - t.startTime : null,
          historyCount: t.history?.length || 0
        };
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this software project data and provide KPI scores (0-100) and a brief strategic summary in Persian (Farsi).
        Data: ${JSON.stringify(projectSummary.slice(0, 50))}
        Criteria: Complexity, Collaboration, Predictability. Return JSON.`,
        config: {
          systemInstruction: "You are a senior technical program manager. Provide data-driven scores and a professional summary in Persian.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              complexityScore: { type: Type.NUMBER },
              collaborationScore: { type: Type.NUMBER },
              predictabilityScore: { type: Type.NUMBER },
              summary: { type: Type.STRING }
            },
            required: ["complexityScore", "collaborationScore", "predictabilityScore", "summary"]
          }
        }
      });

      const data = JSON.parse(cleanJson(response.text || "{}"));
      setAiKpis(data);
    } catch (e) {
      console.error(e);
      alert("AI Analysis failed.");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Performance Insights</h2>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateAiAudit} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4 text-purple-600" />}
                AI Audit
            </Button>
            <Badge variant="outline" className="bg-slate-50">Real-time Data</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RADAR CHART CARD */}
          <Card className="lg:col-span-1">
             <CardHeader className="pb-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                   <BarChart className="h-4 w-4 text-primary" /> Team Proficiency
                </CardTitle>
             </CardHeader>
             <CardContent className="flex flex-col items-center pt-6">
                <RadarChart data={metrics?.radarData || []} />
                <div className="grid grid-cols-3 gap-2 mt-4 w-full">
                    {metrics?.radarData.map(d => (
                        <div key={d.label} className="text-center p-2 bg-slate-50 rounded-lg border">
                           <div className="text-[10px] text-slate-500 font-bold uppercase">{d.label}</div>
                           <div className="text-xs font-black text-slate-800">{d.value}%</div>
                        </div>
                    ))}
                </div>
             </CardContent>
          </Card>

          {/* AI KPI & SUMMARY CARD */}
          <Card className="lg:col-span-2 border-purple-100 bg-purple-50/10">
             <CardHeader className="bg-purple-50 border-b border-purple-100 py-3">
                <CardTitle className="text-sm font-bold text-purple-900 flex items-center justify-between">
                   <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Smart Analysis</span>
                   {aiKpis && <Badge variant="secondary" className="bg-white text-purple-700">Gemini 3.0</Badge>}
                </CardTitle>
             </CardHeader>
             <CardContent className="pt-6">
                {aiKpis ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2 text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Complexity</span>
                            <div className="text-xl font-black text-purple-700">{aiKpis.complexityScore}%</div>
                            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-600" style={{ width: `${aiKpis.complexityScore}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-2 text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Collaboration</span>
                            <div className="text-xl font-black text-blue-700">{aiKpis.collaborationScore}%</div>
                            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600" style={{ width: `${aiKpis.collaborationScore}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-2 text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Predictability</span>
                            <div className="text-xl font-black text-emerald-700">{aiKpis.predictabilityScore}%</div>
                            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600" style={{ width: `${aiKpis.predictabilityScore}%` }}></div>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-purple-100 shadow-sm" dir="auto">
                        <ReactMarkdown className="prose prose-sm max-w-none prose-purple leading-relaxed italic">{aiKpis.summary}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-white/50">
                     <BrainCircuit className="h-12 w-12 mb-2 opacity-20" />
                     <p className="text-sm font-medium">No AI report available</p>
                     <Button variant="link" onClick={generateAiAudit} className="text-xs">Click "AI Audit" to begin</Button>
                  </div>
                )}
             </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Cycle Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics?.avgCycleTime || 0)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Avg. time from In-Progress to Done</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-blue-500" /> Lead Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics?.avgLeadTime || 0)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total time from creation to delivery</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Weekly Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.weeklyThroughput} tasks</div>
            <p className="text-[10px] text-muted-foreground mt-1">Items completed in the last 7 days</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-500" /> Team Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.badges.length} Unlocked</div>
            <p className="text-[10px] text-muted-foreground mt-1">Gamified achievements reached</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HEALTH RINGS & MILESTONE STATUS */}
        <Card>
          <CardHeader className="pb-2">
             <CardTitle className="text-lg flex items-center gap-2">
               <Target className="h-5 w-5 text-emerald-600" /> Milestone Health
             </CardTitle>
             <p className="text-xs text-muted-foreground">Current Active Milestone: <span className="font-bold text-slate-800">{metrics?.activeMilestone?.title || 'None'}</span></p>
          </CardHeader>
          <CardContent className="pt-6">
             <div className="flex justify-around items-center py-4">
                <HealthRing progress={metrics?.healthRings.progress || 0} label="Progress" color="#10b981" />
                <HealthRing progress={metrics?.healthRings.time || 0} label="Elapsed" color="#3b82f6" />
                <HealthRing progress={metrics?.healthRings.quality || 0} label="Quality" color="#f59e0b" />
             </div>
             <div className="mt-6 space-y-2 bg-slate-50 p-4 rounded-lg border">
                <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">Remaining Buffer</span>
                    <span className="font-black text-slate-800">{Math.round(100 - (metrics?.healthRings.time || 0))}% Time</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, 100 - (metrics?.healthRings.time || 0))}%` }}></div>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* GAMIFICATION / BADGES CARD */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" /> Team Achievements
            </CardTitle>
            <p className="text-xs text-muted-foreground">Earning badges through consistent project performance</p>
          </CardHeader>
          <CardContent>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {metrics?.badges.map(b => (
                    <div key={b.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-transform hover:scale-[1.02] cursor-default shadow-sm ${b.bg}`}>
                        <div className={`p-2 rounded-lg bg-white shadow-sm ${b.color}`}>
                            <b.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-slate-800">{b.title}</div>
                            <div className="text-[10px] text-slate-500 leading-tight" dir="auto">{b.desc}</div>
                        </div>
                    </div>
                ))}
                {metrics?.badges.length === 0 && (
                    <div className="col-span-full py-12 text-center text-sm text-muted-foreground italic border-2 border-dashed rounded-lg">
                        Keep pushing to unlock team badges!
                    </div>
                )}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* PROCESS HEALTH LOGIC (FROM PREVIOUS) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Process Diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
                {tasks.filter(t => t.status === 'Testing').length > (tasks.length * 0.3) && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                      <div>
                          <div className="text-sm font-bold text-amber-900">Testing Bottleneck</div>
                          <p className="text-xs text-amber-800/80 mt-0.5">High volume of tasks in Testing. Consider increasing QA capacity.</p>
                      </div>
                  </div>
                )}
                <div className="p-4 bg-slate-50 rounded-lg border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-bold text-slate-700">WIP Tasks</span>
                    </div>
                    <span className="text-2xl font-black text-slate-800">{tasks.filter(t => t.status !== 'Done').length}</span>
                </div>
             </div>
             <div className="flex flex-col justify-center gap-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Overall Completion Success</span>
                    <span className="font-bold text-primary">{tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'Done').length / tasks.length) * 100) : 0}%</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border">
                    <div className="h-full bg-primary" style={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.status === 'Done').length / tasks.length) * 100 : 0}%` }}></div>
                </div>
                <p className="text-[10px] text-center text-muted-foreground italic">Measured against the total task pool across all backlogs.</p>
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
