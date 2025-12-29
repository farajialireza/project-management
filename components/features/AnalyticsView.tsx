
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../ui';
import { Task, UserStory, Milestone } from '../../types';
import { 
  Timer, Zap, TrendingUp, Activity, Sparkles, BrainCircuit, Target, Loader2, 
  Clock, Info, BarChartHorizontal, CheckCircle2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
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
        contents: `Engineering Metrics Data: ${JSON.stringify(metrics)}`,
        config: {
            systemInstruction: "You are a senior engineering director. Analyze the provided SEI/DORA metrics and provide a professional, insightful engineering audit. Identify bottlenecks and suggest improvements. Language: Persian. Use Markdown formatting.",
        }
      });
      setAiSummary(response.text || "");
    } catch (e: any) { 
        console.error("AI Audit failed:", e);
        alert("AI Audit failed: " + (e.message || "Unknown error")); 
    } finally { setAiLoading(false); }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <MetricCard title="Lead Time" value={formatMs(metrics.avgLeadTime)} icon={<Timer className="h-3 w-3"/>} color="blue" tip="زمان کل از تعریف تا اتمام تسک." />
        <MetricCard title="Cycle Time" value={formatMs(metrics.avgCycleTime)} icon={<Clock className="h-3 w-3"/>} color="amber" tip="زمان خالص کار روی تسک." />
        <MetricCard title="Efficiency" value={`${metrics.flowEfficiency.toFixed(1)}%`} icon={<BarChartHorizontal className="h-3 w-3"/>} color="rose" tip="نسبت زمان خالص کار به زمان کل." />
        <MetricCard title="Predictability" value={`${metrics.predictabilityScore.toFixed(0)}%`} icon={<CheckCircle2 className="h-3 w-3"/>} color="indigo" tip="همخوانی تخمین‌ها (Story Points) با زمان واقعی انجام کار." />
        <MetricCard title="Throughput" value={metrics.throughput} icon={<Zap className="h-3 w-3"/>} color="emerald" tip="تعداد تسک‌های انجام شده در ۷ روز اخیر." />
        <MetricCard title="Velocity" value={metrics.completedPoints} icon={<TrendingUp className="h-3 w-3"/>} color="purple" tip="مجموع امتیازهای پیچیدگی تکمیل شده." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="border-b bg-slate-50/50 py-3"><CardTitle className="text-sm font-bold">Team Proficiency Radar</CardTitle></CardHeader>
          <CardContent className="pt-6 flex flex-col items-center">
            <RadarChart data={radarData} />
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
                                <div className="flex justify-between items-end"><span className="text-xs font-bold text-slate-500">REMAINING WORK</span><span className="text-lg font-black">{metrics.forecast.remainingPoints} pts</span></div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.max(10, 100 - (metrics.forecast.remainingPoints / (metrics.forecast.remainingPoints + (metrics.completedPoints || 1)) * 100))}%` }} /></div>
                            </div>
                        </div>
                    ) : <div className="py-8 text-center text-muted-foreground italic">No active milestone tracking.</div>}
                </CardContent>
            </Card>

            <Card className="bg-purple-50/20 border-purple-100">
                <CardHeader className="py-3 border-b border-purple-100 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-700"><Sparkles className="h-4 w-4" /> Qualitative Analysis (AI)</CardTitle>
                    <Button variant="outline" size="sm" onClick={generateAiAudit} disabled={aiLoading} className="h-8 border-purple-200 text-purple-700">
                        {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5 mr-1.5" />}
                        Scan
                    </Button>
                </CardHeader>
                <CardContent className="pt-6">
                    {aiSummary ? (
                        <div className="prose prose-sm max-w-none text-slate-700 italic leading-relaxed" dir="auto">
                            <ReactMarkdown>{aiSummary}</ReactMarkdown>
                        </div>
                    ) : <p className="text-xs text-center py-10 opacity-50">دکمه Scan را بزنید.</p>}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color, tip }: { title: string, value: string | number, icon: React.ReactNode, color: string, tip: string }) => {
  const bgMap: Record<string, string> = { blue: 'bg-blue-50/30 border-blue-100', amber: 'bg-amber-50/30 border-amber-100', rose: 'bg-rose-50/30 border-rose-100', indigo: 'bg-indigo-50/30 border-indigo-100', emerald: 'bg-emerald-50/30 border-emerald-100', purple: 'bg-purple-50/30 border-purple-100' };
  const textMap: Record<string, string> = { blue: 'text-blue-600', amber: 'text-amber-600', rose: 'text-rose-600', indigo: 'text-indigo-600', emerald: 'text-emerald-600', purple: 'text-purple-600' };
  const valMap: Record<string, string> = { blue: 'text-blue-900', amber: 'text-amber-900', rose: 'text-rose-900', indigo: 'text-indigo-900', emerald: 'text-emerald-900', purple: 'text-purple-900' };
  const infoMap: Record<string, string> = { blue: 'text-blue-300', amber: 'text-amber-300', rose: 'text-rose-300', indigo: 'text-indigo-300', emerald: 'text-emerald-300', purple: 'text-purple-300' };

  return (
    <Card className={`${bgMap[color]} group relative cursor-help transition-all hover:shadow-sm`} title={tip}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className={`text-[9px] font-black ${textMap[color]} uppercase tracking-widest flex items-center gap-1.5`}>{icon} {title}</CardTitle>
            <Info className={`h-3 w-3 ${infoMap[color]} opacity-0 group-hover:opacity-100 transition-opacity`} />
        </CardHeader>
        <CardContent><div className={`text-xl font-black ${valMap[color]}`}>{value}</div></CardContent>
    </Card>
  );
};
