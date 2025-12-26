
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../ui';
import { Task, UserStory, Milestone } from '../../types';
import { 
  Timer, Zap, TrendingUp, Activity, Sparkles, BrainCircuit, Target, Loader2, 
  ShieldCheck, Flame, Clock, BarChart, ChevronRight, AlertCircle, Layers, Info
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { storiesApi, tasksApi, milestonesApi } from '../../api/project';
import { calculateDoraMetrics, formatMs } from '../../utils/analytics';

const RadarChart = ({ data, size = 260 }: { data: { label: string; value: number }[]; size?: number }) => {
  const center = size / 2;
  const radius = size * 0.35;
  const angleStep = (Math.PI * 2) / data.length;
  const points = data.map((d, i) => {
    const r = (Math.max(10, d.value) / 100) * radius;
    const x = center + r * Math.cos(i * angleStep - Math.PI / 2);
    const y = center + r * Math.sin(i * angleStep - Math.PI / 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="relative flex items-center justify-center bg-white p-2 rounded-xl">
      <svg width={size} height={size} className="overflow-visible">
        {[0.5, 1].map((level) => (<polygon key={level} points={data.map((_, i) => { const r = level * radius; return `${center + r * Math.cos(i * angleStep - Math.PI / 2)},${center + r * Math.sin(i * angleStep - Math.PI / 2)}`; }).join(' ')} className="fill-none stroke-slate-100" strokeWidth="1" />))}
        {data.map((d, i) => {
             const x = center + (radius + 20) * Math.cos(i * angleStep - Math.PI / 2);
             const y = center + (radius + 20) * Math.sin(i * angleStep - Math.PI / 2);
             return <text key={i} x={x} y={y} textAnchor="middle" className="text-[9px] font-bold fill-slate-400 uppercase">{d.label}</text>
        })}
        <polygon points={points} className="fill-primary/20 stroke-primary transition-all duration-700" strokeWidth="2" />
      </svg>
    </div>
  );
};

export const AnalyticsView = () => {
  const [data, setData] = useState<{ tasks: Task[], stories: UserStory[], milestones: Milestone[] }>({ tasks: [], stories: [], milestones: [] });
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ts, sts, ms] = await Promise.all([tasksApi.getAll(), storiesApi.getAll(), milestonesApi.getAll()]);
        setData({ tasks: ts, stories: sts, milestones: ms });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  const metrics = useMemo(() => calculateDoraMetrics(data.tasks, data.stories, data.milestones), [data]);

  const radarData = [
    { label: 'Speed', value: metrics.radarMetrics.speed },
    { label: 'Predictability', value: metrics.radarMetrics.predictability },
    { label: 'Quality', value: metrics.radarMetrics.quality },
    { label: 'Collaboration', value: metrics.radarMetrics.collaboration },
    { label: 'Stability', value: metrics.radarMetrics.stability },
  ];

  const generateAiAudit = async () => {
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these SEI metrics: ${JSON.stringify(metrics)}. Tasks: ${JSON.stringify(data.tasks.slice(0, 20))}. Provide a professional engineering summary in Persian.`,
      });
      setAiSummary(response.text || "");
    } catch (e) { alert("AI Audit failed."); } finally { setAiLoading(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Activity className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Engineering Intelligence</h2>
            <p className="text-sm text-muted-foreground">Real-time DORA & Flow metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Lead Time */}
        <Card className="bg-blue-50/30 border-blue-100 group relative cursor-help" title="زمان از لحظه تعریف تسک تا اتمام آن (Lead Time). نشان‌دهنده سرعت کل فرآیند تحویل است. بر حسب روز و ساعت.">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5"><Timer className="h-3 w-3"/> Lead Time</CardTitle>
                <Info className="h-3 w-3 text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-blue-900">{formatMs(metrics.avgLeadTime)}</div>
                <p className="text-[10px] text-blue-600 font-bold mt-1">Creation to Delivery</p>
            </CardContent>
        </Card>

        {/* Throughput */}
        <Card className="bg-emerald-50/30 border-emerald-100 group relative cursor-help" title="تعداد تسک‌های انجام شده در ۷ روز گذشته (Throughput). نشان‌دهنده ظرفیت خروجی تیم است. بر حسب تعداد تسک.">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5"><Zap className="h-3 w-3"/> Throughput</CardTitle>
                <Info className="h-3 w-3 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-emerald-900">{metrics.throughput} <span className="text-xs font-normal">tasks</span></div>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">Completed last 7 days</p>
            </CardContent>
        </Card>

        {/* Cycle Time */}
        <Card className="bg-amber-50/30 border-amber-100 group relative cursor-help" title="زمان صرف شده روی تسک از لحظه شروع تا اتمام (Cycle Time). نشان‌دهنده سرعت خالص توسعه است. بر حسب روز و ساعت.">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5"><Clock className="h-3 w-3"/> Cycle Time</CardTitle>
                <Info className="h-3 w-3 text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-amber-900">{formatMs(metrics.avgCycleTime)}</div>
                <p className="text-[10px] text-amber-600 font-bold mt-1">In-Progress to Done</p>
            </CardContent>
        </Card>

        {/* Velocity */}
        <Card className="bg-purple-50/30 border-purple-100 group relative cursor-help" title="مجموع امتیازهای پیچیدگی (Story Points) تکمیل شده. نشان‌دهنده حجم کار فنی تحویل داده شده. بر حسب امتیاز.">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp className="h-3 w-3"/> Velocity</CardTitle>
                <Info className="h-3 w-3 text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-black text-purple-900">{metrics.completedPoints} <span className="text-xs font-normal">pts</span></div>
                <p className="text-[10px] text-purple-600 font-bold mt-1">Total Story Points delivered</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="border-b bg-slate-50/50 py-3"><CardTitle className="text-sm font-bold">Team Proficiency Radar</CardTitle></CardHeader>
          <CardContent className="pt-6 flex flex-col items-center">
            <RadarChart data={radarData} />
            <div className="grid grid-cols-2 gap-4 w-full mt-4 border-t pt-4">
                <div className="text-center"><span className="text-[10px] font-bold text-slate-400 block uppercase">FE Focus</span><span className="text-sm font-black">{metrics.workDistribution.frontend} tasks</span></div>
                <div className="text-center"><span className="text-[10px] font-bold text-slate-400 block uppercase">BE Focus</span><span className="text-sm font-black">{metrics.workDistribution.backend} tasks</span></div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
            <Card className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="py-3 bg-slate-50/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><Target className="h-4 w-4 text-primary"/> Milestone Forecast</CardTitle>
                    {metrics.forecast && <Badge variant={metrics.forecast.status === 'On Track' ? 'default' : 'destructive'} className="text-[10px]">{metrics.forecast.status}</Badge>}
                </CardHeader>
                <CardContent className="pt-6">
                    {metrics.forecast ? (
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1 space-y-4 w-full">
                                <div className="flex justify-between items-end"><span className="text-xs font-bold text-slate-500">REMAINING WORK</span><span className="text-lg font-black">{metrics.forecast.remainingPoints} Story Points</span></div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.max(10, 100 - (metrics.forecast.remainingPoints / (metrics.forecast.remainingPoints + metrics.completedPoints || 1) * 100))}%` }} /></div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3 w-3"/> Estimated time to completion: <b className="text-slate-900">{metrics.forecast.estimatedWeeks} weeks</b></div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border w-full md:w-auto text-center space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Health Score</span>
                                <div className="text-3xl font-black text-primary">{metrics.radarMetrics.predictability}%</div>
                            </div>
                        </div>
                    ) : <div className="py-8 text-center text-muted-foreground italic">No active milestone tracking available.</div>}
                </CardContent>
            </Card>

            <Card className="bg-purple-50/20 border-purple-100">
                <CardHeader className="py-3 border-b border-purple-100 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-700">
                        <Sparkles className="h-4 w-4" /> Qualitative Analysis (AI)
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={generateAiAudit} disabled={aiLoading} className="h-8 border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-800 transition-colors">
                        {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5 mr-1.5" />}
                        {aiSummary ? "Rescan" : "Deep Scan"}
                    </Button>
                </CardHeader>
                <CardContent className="pt-6">
                    {aiSummary ? (
                        <div className="prose prose-sm max-w-none text-slate-700 italic leading-relaxed" dir="auto">
                            <ReactMarkdown>{aiSummary}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 opacity-60">
                            <BrainCircuit className="h-10 w-10 text-purple-300" />
                            <p className="text-xs font-medium text-slate-500">دکمه Deep Scan را برای تحلیل کیفی رفتار تیم توسط هوش مصنوعی بزنید.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};
