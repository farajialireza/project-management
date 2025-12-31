
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Button, Card, CardHeader, CardTitle, CardContent, Textarea, Label, Input, Badge } from '../ui';
import { Loader2, FileText, Sparkles, Trash2, AlertCircle, ListTodo, Settings2, Construction, Bug, CheckSquare, Layers } from 'lucide-react';
import { ProductBacklog, UserStory, Task, SubTask } from '../../types';
import { backlogsApi, storiesApi, tasksApi } from '../../api/project';

// --- Types & Helpers ---
interface GeneratedTask {
  title: string;
  description: string;
  stack: 'Frontend' | 'Backend';
  subtasks: string[];
}

const sanitizeString = (str: any): string => (str && typeof str === 'string' ? str : "");
const sanitizePriority = (p: any): 'Low' | 'Medium' | 'High' => {
  if (typeof p === 'string') {
     const up = p.toUpperCase();
     if (up.includes('P1') || up.includes('HIGH') || up.includes('بالا')) return 'High';
     if (up.includes('P2') || up.includes('MEDIUM') || up.includes('متوسط')) return 'Medium';
     if (up.includes('P3') || up.includes('LOW') || up.includes('پایین')) return 'Low';
  }
  return 'Medium';
};
const sanitizeNumber = (n: any): number => (typeof n === 'number' && !isNaN(n) ? n : 1);

const cleanJson = (text: string) => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return match[1];
  return text.trim();
};

// --- New Component: Task Designer ---

const TaskDesignerSection = () => {
  const [stories, setStories] = useState<(UserStory & { backlogTitle?: string })[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [taskMode, setTaskMode] = useState<'Feature' | 'Bug Fix'>('Feature');
  const [frontendDocs, setFrontendDocs] = useState(() => localStorage.getItem('axis_fe_arch_docs') || "");
  const [backendDocs, setBackendDocs] = useState(() => localStorage.getItem('axis_be_arch_docs') || "");
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => { 
      const data = await storiesApi.getAll(); 
      setStories(data); 
    };
    fetch();
  }, []);

  // Persist docs
  useEffect(() => { localStorage.setItem('axis_fe_arch_docs', frontendDocs); }, [frontendDocs]);
  useEffect(() => { localStorage.setItem('axis_be_arch_docs', backendDocs); }, [backendDocs]);

  const handleGenerate = async () => {
    if (!selectedStoryId) return;
    const story = stories.find(s => s.id === selectedStoryId);
    setLoading(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `
          ARCHITECTURE CONTEXT:
          --- FRONTEND STRUCTURE ---
          ${frontendDocs || "No specific frontend documentation provided."}
          
          --- BACKEND STRUCTURE ---
          ${backendDocs || "No specific backend documentation provided."}

          USER STORY TO ARCHITECT:
          Title: ${story?.title}
          Description: ${story?.description}
          Mode: ${taskMode} (${taskMode === 'Feature' ? 'New implementation' : 'Fixing an existing issue'})

          TASK:
          Generate a technical blueprint for implementing/fixing this story.
          Break it down into logical Frontend and Backend tasks.
          For each task, provide 3-7 specific sub-tasks (steps) that follow the project's architectural guidelines provided above.
          Language: Persian. Return strict JSON.
        `,
        config: {
          systemInstruction: `You are the Lead Architect for the 'axis' project management system. 
          Your goal is to bridge the gap between business requirements (User Stories) and technical implementation.
          Strictly adhere to the provided Markdown architecture documents. 
          If Frontend docs specify a certain folder structure or state management tool, the sub-tasks must reflect that.
          If Backend docs specify a service-repository pattern or specific routing, the sub-tasks must reflect that.
          Tasks for 'Bug Fix' should emphasize tracing, debugging, and regression testing.
          Tasks for 'Feature' should emphasize data models, UI components, and API integration.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    stack: { type: Type.STRING, description: "Must be 'Frontend' or 'Backend'" },
                    subtasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "description", "stack", "subtasks"]
                }
              }
            },
            required: ["tasks"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(cleanJson(response.text));
        if (data.tasks) setGeneratedTasks(data.tasks);
      }
    } catch (e: any) {
      alert("Architecting failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToBoard = async () => {
    if (generatedTasks.length === 0 || !selectedStoryId) return;
    const story = stories.find(s => s.id === selectedStoryId);
    if (!story) return;

    setSaving(true);
    try {
      const now = Date.now();
      const tasksToCreate = generatedTasks.map(gt => {
        const subtasks: SubTask[] = gt.subtasks.map(stTitle => ({
          id: Math.random().toString(36).substr(2, 9),
          title: stTitle,
          isDone: false
        }));

        return {
          title: gt.title,
          description: gt.description,
          status: 'To Do' as const,
          userStoryId: story.id,
          backlogId: story.backlogId,
          panel: story.panel || 'Admin',
          stack: gt.stack,
          createdAt: now,
          subtasks,
          history: [{ status: 'To Do', timestamp: now, userId: 'ai-architect', userName: 'Architect AI' }],
          createdBy: { userId: 'ai-architect', userName: 'Architect AI' }
        } as Partial<Task>;
      });

      await tasksApi.bulkSave(tasksToCreate);
      setGeneratedTasks([]);
      alert("تسک‌های فنی با موفقیت به برد پروژه اضافه شدند.");
    } catch (e) {
      alert("Failed to save tasks.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Architect Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> تنظیمات معمار پروژه
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label>یوزر استوری هدف</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  value={selectedStoryId} 
                  onChange={(e) => setSelectedStoryId(e.target.value)}
                >
                  <option value="">-- انتخاب استوری --</option>
                  {stories.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.backlogTitle ? `${s.backlogTitle} > ` : ''}{s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>نوع عملیات فنی</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={taskMode === 'Feature' ? 'default' : 'outline'} 
                    size="sm" className="flex-1 gap-2"
                    onClick={() => setTaskMode('Feature')}
                  >
                    <Construction className="h-4 w-4" /> Feature
                  </Button>
                  <Button 
                    variant={taskMode === 'Bug Fix' ? 'destructive' : 'outline'} 
                    size="sm" className="flex-1 gap-2"
                    onClick={() => setTaskMode('Bug Fix')}
                  >
                    <Bug className="h-4 w-4" /> Bug Fix
                  </Button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3 w-3" /> مستندات ساختار فرانت‌اند (Markdown)
                  </Label>
                  <Textarea 
                    placeholder="E.g. Folder structure, UI kits, State logic..." 
                    value={frontendDocs} 
                    onChange={(e) => setFrontendDocs(e.target.value)}
                    className="min-h-[120px] text-xs font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3 w-3" /> مستندات ساختار بک‌اند (Markdown)
                  </Label>
                  <Textarea 
                    placeholder="E.g. API routes, Models, Services pattern..." 
                    value={backendDocs} 
                    onChange={(e) => setBackendDocs(e.target.value)}
                    className="min-h-[120px] text-xs font-mono"
                  />
                </div>
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={loading || !selectedStoryId} 
                className="w-full mt-4 bg-primary hover:bg-primary/90"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                طراحی معماری تسک‌ها
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Architect Output Area */}
        <div className="lg:col-span-8">
          <Card className="h-full min-h-[600px] flex flex-col">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" /> نقشه راه فنی (Technical Blueprint)
              </CardTitle>
              {generatedTasks.length > 0 && (
                <Button 
                  onClick={handleSaveToBoard} 
                  disabled={saving} 
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs"
                >
                  {saving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <CheckSquare className="mr-1.5 h-3 w-3" />}
                  تایید و ذخیره در برد
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {generatedTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                  <Construction className="h-16 w-16 mb-4" />
                  <h3 className="text-lg font-bold">آماده برای طراحی</h3>
                  <p className="text-sm max-w-xs">مستندات و استوری را انتخاب کنید تا دستیار هوش مصنوعی تسک‌های فنی را طبق معماری شما استخراج کند.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {generatedTasks.map((task, idx) => (
                    <div key={idx} className="bg-white border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="bg-slate-100/50 px-4 py-3 border-b flex justify-between items-center">
                        <h4 className="font-bold text-slate-800" dir="auto">{task.title}</h4>
                        <Badge variant={task.stack === 'Backend' ? 'default' : 'secondary'} className="text-[10px] tracking-wider uppercase">{task.stack}</Badge>
                      </div>
                      <div className="p-4 space-y-4">
                        <p className="text-xs text-slate-600 leading-relaxed" dir="auto">{task.description}</p>
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                            <CheckSquare className="h-3 w-3" /> مراحل پیاده‌سازی طبق مستندات
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {task.subtasks.map((st, sidx) => (
                              <div key={sidx} className="flex items-center gap-2 p-2 bg-slate-50 border rounded text-[11px] text-slate-700" dir="auto">
                                <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold flex-shrink-0">{sidx + 1}</span>
                                {st}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const FeatureBreakdownSection = () => {
  const [featureDescription, setFeatureDescription] = useState("");
  const [generatedBacklogs, setGeneratedBacklogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<'Admin' | 'Customer'>('Admin');

  const handleGenerate = async () => {
    if (!featureDescription) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Input Description: ${featureDescription}`,
        config: {
          systemInstruction: `Convert the following description into high-level Backlogs for the ${selectedPanel} panel of 'axis'. 
          STRICT: Only map what is explicitly described. Language: Persian. Return JSON format.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { 
                backlogs: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: { 
                            displayId: { type: Type.STRING }, 
                            title: { type: Type.STRING }, 
                            description: { type: Type.STRING }, 
                            priority: { type: Type.STRING } 
                        },
                        required: ["title", "description", "priority"]
                    } 
                } 
            },
            required: ["backlogs"]
          }
        }
      });
      if (response.text) {
        const data = JSON.parse(cleanJson(response.text));
        if (data.backlogs) setGeneratedBacklogs(data.backlogs);
      }
    } catch (e) { alert("Failed to generate."); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (generatedBacklogs.length === 0) return;
    setSaving(true);
    try {
      for (const bl of generatedBacklogs) {
        await backlogsApi.save({
          title: sanitizeString(bl.title), description: sanitizeString(bl.description),
          priority: sanitizePriority(bl.priority), displayId: sanitizeString(bl.displayId),
          panel: selectedPanel
        });
      }
      setGeneratedBacklogs([]); setFeatureDescription(""); alert("Backlogs created.");
    } catch (e) { alert("Save failed."); } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card><CardHeader><CardTitle>Feature Description</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2"><Label>Target Panel</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPanel} onChange={(e) => setSelectedPanel(e.target.value as any)}><option value="Admin">Admin</option><option value="Customer">Customer</option></select></div>
        <Textarea className="min-h-[200px] text-right" dir="rtl" placeholder="Describe your feature flow..." value={featureDescription} onChange={(e) => setFeatureDescription(e.target.value)} />
        <Button onClick={handleGenerate} disabled={loading || !featureDescription} className="w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Extract Backlogs"}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Extracted Backlogs</CardTitle></CardHeader><CardContent>
        {generatedBacklogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground border-2 border-dashed rounded-lg"><Sparkles className="h-10 w-10 mb-2 opacity-50" /><p>Results will appear here</p></div>
        ) : (
            <div className="space-y-4">
                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                    {generatedBacklogs.map((bl, i) => (<div key={i} className="border rounded p-3 bg-white text-right" dir="rtl"><span className="font-semibold text-sm">{bl.title}</span></div>))}
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">Create Backlogs</Button>
            </div>
        )}
      </CardContent></Card>
    </div>
  );
};

const StoryGeneratorSection = () => {
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [selectedBacklogId, setSelectedBacklogId] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [generatedStories, setGeneratedStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => { const data = await backlogsApi.getAll(); setBacklogs(data); };
    fetch();
  }, []);

  const handleGenerate = async () => {
    if (!workflowDescription || !selectedBacklogId) return;
    setLoading(true);
    const bl = backlogs.find(b => b.id === selectedBacklogId);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Backlog: ${bl?.title}. Workflow Input: ${workflowDescription}.`,
        config: {
          systemInstruction: `Convert the provided workflow into literal User Stories for the ${bl?.panel || 'Admin'} panel of 'axis'. 
          STRICT: Only create stories for what is explicitly described. Language: Persian. Return JSON format.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { 
                stories: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: { 
                            title: { type: Type.STRING }, 
                            description: { type: Type.STRING }, 
                            priority: { type: Type.STRING }, 
                            points: { type: Type.NUMBER }, 
                            displayId: { type: Type.STRING } 
                        },
                        required: ["title", "description", "priority", "points"]
                    } 
                } 
            },
            required: ["stories"]
          }
        }
      });
      if (response.text) {
        const data = JSON.parse(cleanJson(response.text));
        if (data.stories) setGeneratedStories(data.stories);
      }
    } catch (e) { alert("AI error."); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (generatedStories.length === 0 || !selectedBacklogId) return;
    setSaving(true);
    const parent = backlogs.find(b => b.id === selectedBacklogId);
    try {
      for (const st of generatedStories) {
        await storiesApi.save({
          backlogId: selectedBacklogId, 
          title: sanitizeString(st.title),
          description: sanitizeString(st.description), 
          priority: sanitizePriority(st.priority),
          points: sanitizeNumber(st.points), 
          displayId: sanitizeString(st.displayId),
          panel: parent?.panel || 'Admin'
        });
      }
      setGeneratedStories([]); setWorkflowDescription(""); alert("Stories saved.");
    } catch (e) { alert("Save failed."); } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card><CardHeader><CardTitle>Story Generator</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2"><Label>Select Parent Backlog</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedBacklogId} onChange={(e) => setSelectedBacklogId(e.target.value)}><option value="">-- Select --</option>{backlogs.map(b => <option key={b.id} value={b.id}>{b.title} ({b.panel || 'Admin'})</option>)}</select></div>
        <Textarea className="min-h-[200px] text-right" dir="rtl" placeholder="Describe workflow..." value={workflowDescription} onChange={(e) => setWorkflowDescription(e.target.value)} />
        <Button onClick={handleGenerate} disabled={loading || !workflowDescription || !selectedBacklogId} className="w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Extract Stories"}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Extracted Stories</CardTitle></CardHeader><CardContent>
        {generatedStories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground border-2 border-dashed rounded-lg"><ListTodo className="h-10 w-10 mb-2 opacity-50" /><p>Literal stories will appear here</p></div>
        ) : (
            <div className="space-y-4">
                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                    {generatedStories.map((s, i) => (<div key={i} className="border rounded p-3 bg-white text-right" dir="rtl"><div className="flex justify-between items-start mb-1"><b>{s.title}</b><Badge>{s.points} pts</Badge></div></div>))}
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">Save Stories</Button>
            </div>
        )}
      </CardContent></Card>
    </div>
  );
};

// --- Main View ---

export const AiAssistantView = () => {
  const [mode, setMode] = useState<'architect' | 'feature' | 'story'>('architect');
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex space-x-2 border-b pb-4 overflow-x-auto">
        <Button 
          variant={mode === 'architect' ? 'default' : 'ghost'} 
          size="sm" 
          onClick={() => setMode('architect')} 
          className="gap-2"
        >
          <Construction className="h-4 w-4" /> معمار تسک (Architect)
        </Button>
        <Button 
          variant={mode === 'feature' ? 'default' : 'ghost'} 
          size="sm" 
          onClick={() => setMode('feature')} 
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" /> Feature Breakdown
        </Button>
        <Button 
          variant={mode === 'story' ? 'default' : 'ghost'} 
          size="sm" 
          onClick={() => setMode('story')} 
          className="gap-2"
        >
          <ListTodo className="h-4 w-4" /> Story Generator
        </Button>
      </div>

      <div className="mt-6">
        {mode === 'architect' && <TaskDesignerSection />}
        {mode === 'feature' && <FeatureBreakdownSection />}
        {mode === 'story' && <StoryGeneratorSection />}
      </div>
    </div>
  );
};
