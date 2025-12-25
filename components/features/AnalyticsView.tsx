
import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../ui';
import { Task, UserStory, Milestone } from '../../types';
import { Timer, Zap, History, TrendingUp, Activity, AlertTriangle, Sparkles, BrainCircuit, Users, Target, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';

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
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiKpis, setAiKpis] = useState<AiKpis | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [taskSnap, msSnap] = await Promise.all([
        getDocs(collection(db, "tasks")),
        getDocs(collection(db, "milestones"))
      ]);

      const loadedTasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(loadedTasks);
      setMilestones(msSnap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));

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

  const generateAiAudit = async () => {
    setAiLoading(true);
    try {
      // Prepare data for AI without sensitive details
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
        
        Criteria:
        1. Complexity Score: Ratio of subtasks to story points.
        2. Collaboration Score: Engagement via comments and status changes.
        3. Predictability Score: Variance in task durations relative to their complexity.
        
        Return JSON format.`,
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

  // --- KPI Calculations ---
  const doneTasks = tasks.filter(t => t.status === 'Done' && t.startTime && t.endTime);
  const avgCycleTime = doneTasks.length > 0 
    ? doneTasks.reduce((acc, t) => acc + (t.endTime! - t.startTime!), 0) / doneTasks.length 
    : 0;

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

  const milestoneVelocity = milestones.map(m => {
    const milestoneStories = stories.filter(s => {
        const storyTasks = tasks.filter(t => t.userStoryId === s.id);
        const isDone = storyTasks.length > 0 && storyTasks.every(t => t.status === 'Done');
        return isDone && storyTasks.some(t => t.milestoneId === m.id);
    });
    return {
      title: m.title,
      points: milestoneStories.reduce((acc, s) => acc + (s.points || 0), 0)
    };
  });

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const weeklyThroughput = tasks.filter(t => t.status === 'Done' && t.endTime && t.endTime > sevenDaysAgo).length;

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

      {/* AI KPI SECTION */}
      {aiKpis && (
        <Card className="border-purple-200 bg-purple-50/30 overflow-hidden">
           <CardHeader className="bg-purple-100/50 border-b border-purple-100 flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-bold text-purple-900 flex items-center gap-2">
                 <Sparkles className="h-4 w-4" /> AI Project Scoring (KPIs)
              </CardTitle>
              <Badge className="bg-purple-600">Generated with Gemini</Badge>
           </CardHeader>
           <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><Zap className="h-3 w-3" /> Complexity</span>
                       <span className="text-sm font-black text-purple-700">{aiKpis.complexityScore}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-purple-600 transition-all duration-1000" style={{ width: `${aiKpis.complexityScore}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-500">توازن بین حجم کار فنی و تخمین بکلگ</p>
                 </div>
                 
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><Users className="h-3 w-3" /> Collaboration</span>
                       <span className="text-sm font-black text-purple-700">{aiKpis.collaborationScore}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${aiKpis.collaborationScore}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-500">میزان تعامل تیم در کامنت‌ها و تغییر وضعیت‌ها</p>
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><Target className="h-3 w-3" /> Predictability</span>
                       <span className="text-sm font-black text-purple-700">{aiKpis.predictabilityScore}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-600 transition-all duration-1000" style={{ width: `${aiKpis.predictabilityScore}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-500">دقت پیش‌بینی زمان تحویل بر اساس الگوهای قبلی</p>
                 </div>
              </div>
              <div className="bg-white/80 p-4 rounded-lg border border-purple-100 text-sm leading-relaxed" dir="auto">
                 <ReactMarkdown className="prose prose-sm max-w-none">{aiKpis.summary}</ReactMarkdown>
              </div>
           </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Cycle Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgCycleTime)}</div>
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
            <div className="text-2xl font-bold">{formatDuration(avgLeadTime)}</div>
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
            <div className="text-2xl font-bold">{weeklyThroughput} tasks</div>
            <p className="text-[10px] text-muted-foreground mt-1">Items completed in the last 7 days</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" /> Active Stories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stories.filter(s => !completedStories.find(cs => cs.id === s.id)).length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Stories currently in backlog or board</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Milestone Velocity</CardTitle>
            <p className="text-xs text-muted-foreground">Story points delivered per milestone</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-4">
              {milestoneVelocity.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground italic border-2 border-dashed rounded">No milestone data yet.</div>
              ) : (
                milestoneVelocity.map((v, i) => {
                  const maxVal = Math.max(...milestoneVelocity.map(mv => mv.points), 1);
                  const barWidth = (v.points / maxVal) * 100;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{v.title}</span>
                        <span className="text-primary font-bold">{v.points} pts</span>
                      </div>
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-1000 rounded-full" 
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Process Health</CardTitle>
            <p className="text-xs text-muted-foreground">Detection of potential bottlenecks</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {tasks.filter(t => t.status === 'Testing').length > (tasks.length * 0.3) && (
                 <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                        <div className="text-sm font-bold text-amber-900">Testing Bottleneck</div>
                        <p className="text-xs text-amber-800/80 mt-0.5">High volume of tasks in Testing. Consider increasing QA capacity or reviewer attention.</p>
                    </div>
                 </div>
               )}

               <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 rounded-lg border text-center">
                    <div className="text-3xl font-black text-slate-800">{tasks.filter(t => t.status !== 'Done').length}</div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">WIP Tasks</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border text-center">
                    <div className="text-3xl font-black text-slate-800">
                      {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'Done').length / tasks.length) * 100) : 0}%
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Overall Success</div>
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
