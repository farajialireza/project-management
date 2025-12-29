
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Button, Card, CardHeader, CardTitle, CardContent, Textarea, Label, Input, Badge } from '../ui';
import { Loader2, FileText, Sparkles, Trash2, AlertCircle, ListTodo } from 'lucide-react';
import { ProductBacklog, UserStory, Task } from '../../types';
import { backlogsApi, storiesApi, tasksApi } from '../../api/project';

// --- Types & Helpers ---
interface GeneratedStory {
  displayId?: string;
  title: string;
  description: string;
  role?: string;
  priority: 'Low' | 'Medium' | 'High';
  points: number;
}

interface GeneratedBacklog {
  displayId?: string;
  title: string;
  description: string;
  role?: string;
  priority?: 'Low' | 'Medium' | 'High';
  stories: GeneratedStory[];
}

interface GeneratedData {
  backlogs: GeneratedBacklog[];
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

// --- Sub-sections ---

const BulkImportSection = () => {
  const [text, setText] = useState("");
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<'Admin' | 'Customer'>('Admin');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setText(e.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setGeneratedData(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Input Text: ${text.slice(0, 20000)}`,
        config: {
          systemInstruction: `You are a literal data extractor. Your ONLY job is to map the provided text into a Backlog and User Story structure. 
          STRICT RULES:
          1. Do NOT invent new features. 
          2. Do NOT add technical requirements that are not mentioned.
          3. Only extract what is explicitly written. 
          4. If the text is a simple list, map each item to a Backlog or Story exactly as written.
          5. Language: Persian. Return strict JSON format.`,
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
                    role: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    stories: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          displayId: { type: Type.STRING },
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          priority: { type: Type.STRING },
                          points: { type: Type.NUMBER }
                        },
                        required: ["title", "description", "priority", "points"]
                      }
                    }
                  },
                  required: ["title", "description", "priority", "stories"]
                }
              }
            },
            required: ["backlogs"]
          }
        }
      });
      if (response.text) setGeneratedData(JSON.parse(cleanJson(response.text)));
    } catch (error: any) {
      console.error("AI Analysis failed:", error);
      alert("AI Analysis failed: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!generatedData) return;
    setImporting(true);
    try {
      for (const bl of generatedData.backlogs) {
        const savedBacklog = await backlogsApi.save({
          title: sanitizeString(bl.title), description: sanitizeString(bl.description),
          displayId: sanitizeString(bl.displayId), role: sanitizeString(bl.role),
          priority: sanitizePriority(bl.priority), panel: selectedPanel
        });
        if (bl.stories?.length > 0) {
          for (const st of bl.stories) {
            await storiesApi.save({
              backlogId: savedBacklog.id, displayId: sanitizeString(st.displayId),
              title: sanitizeString(st.title), description: sanitizeString(st.description),
              priority: sanitizePriority(st.priority), points: sanitizeNumber(st.points),
              panel: selectedPanel
            });
          }
        }
      }
      alert("Successfully imported.");
      setGeneratedData(null); setText("");
    } catch (e) {
      alert("Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="h-fit">
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Input Requirements</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Target Panel</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPanel} onChange={(e) => setSelectedPanel(e.target.value as any)}><option value="Admin">Admin</option><option value="Customer">Customer</option></select></div>
          <div className="space-y-2"><Label>Upload File</Label><Input type="file" onChange={handleFileChange} /></div>
          <div className="space-y-2"><Label>Paste Content</Label><Textarea className="min-h-[300px]" value={text} onChange={(e) => setText(e.target.value)} /></div>
          <Button onClick={handleAnalyze} disabled={loading || !text} className="w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Analyze & Map with AI"}</Button>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>Preview & Import</CardTitle></CardHeader>
        <CardContent>
          {!generatedData ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground border-2 border-dashed rounded-lg"><FileText className="h-10 w-10 mb-2 opacity-50" /><p>Preview will appear here</p></div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
                {generatedData.backlogs.map((bl, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-2 bg-secondary/20">
                    <h3 className="font-bold text-lg">{bl.title}</h3>
                    <Badge variant="outline">{bl.stories?.length || 0} items extracted</Badge>
                  </div>
                ))}
              </div>
              <Button onClick={handleImport} disabled={importing} className="w-full" variant="default">{importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm & Import"}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const FeatureBreakdownSection = () => {
  const [featureDescription, setFeatureDescription] = useState("");
  const [generatedBacklogs, setGeneratedBacklogs] = useState<GeneratedBacklog[]>([]);
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
          systemInstruction: `Convert the following description into high-level Backlogs for the ${selectedPanel} panel. 
          STRICT: Do NOT add any extra features. Do NOT split one idea into multiple unnecessary backlogs. Be concise and use the user's terminology.
          Language: Persian. Return JSON format.`,
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
        <Textarea className="min-h-[200px] text-right" dir="rtl" placeholder="Describe your feature literal flow..." value={featureDescription} onChange={(e) => setFeatureDescription(e.target.value)} />
        <Button onClick={handleGenerate} disabled={loading || !featureDescription} className="w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Extract Backlogs"}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Extracted Backlogs</CardTitle></CardHeader><CardContent>
        {generatedBacklogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground border-2 border-dashed rounded-lg"><Sparkles className="h-10 w-10 mb-2 opacity-50" /><p>Literal results will appear here</p></div>
        ) : (
            <div className="space-y-4"><div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">{generatedBacklogs.map((bl, i) => (<div key={i} className="border rounded p-3 bg-white text-right" dir="rtl"><span className="font-semibold text-sm">{bl.title}</span></div>))}</div><Button onClick={handleSave} disabled={saving} className="w-full">Create Backlogs</Button></div>
        )}
      </CardContent></Card>
    </div>
  );
};

const StoryGeneratorSection = () => {
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [selectedBacklogId, setSelectedBacklogId] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [generatedStories, setGeneratedStories] = useState<GeneratedStory[]>([]);
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
          systemInstruction: `Convert the provided workflow into literal User Stories for the ${bl?.panel || 'Admin'} panel. 
          STRICT: Only create stories for what is explicitly described in the workflow. Do NOT add "best practices" or "extra features" or "security layers" unless mentioned.
          Language: Persian. Return JSON format.`,
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
        <Textarea className="min-h-[200px] text-right" dir="rtl" placeholder="Describe workflow literally..." value={workflowDescription} onChange={(e) => setWorkflowDescription(e.target.value)} />
        <Button onClick={handleGenerate} disabled={loading || !workflowDescription || !selectedBacklogId} className="w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Extract Stories"}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Extracted Stories</CardTitle></CardHeader><CardContent>
        {generatedStories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground border-2 border-dashed rounded-lg"><ListTodo className="h-10 w-10 mb-2 opacity-50" /><p>Literal stories will appear here</p></div>
        ) : (
            <div className="space-y-4"><div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">{generatedStories.map((s, i) => (<div key={i} className="border rounded p-3 bg-white text-right" dir="rtl"><div className="flex justify-between items-start mb-1"><b>{s.title}</b><Badge>{s.points} pts</Badge></div></div>))}</div><Button onClick={handleSave} disabled={saving} className="w-full">Save Stories</Button></div>
        )}
      </CardContent></Card>
    </div>
  );
};

// --- Main View ---

export const AiAssistantView = () => {
  const [mode, setMode] = useState<'bulk' | 'feature' | 'story'>('bulk');
  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b pb-4 overflow-x-auto">
        <Button variant={mode === 'bulk' ? 'default' : 'ghost'} onClick={() => setMode('bulk')}><FileText className="mr-2 h-4 w-4" /> Bulk Import</Button>
        <Button variant={mode === 'feature' ? 'default' : 'ghost'} onClick={() => setMode('feature')}><Sparkles className="mr-2 h-4 w-4" /> Feature Breakdown</Button>
        <Button variant={mode === 'story' ? 'default' : 'ghost'} onClick={() => setMode('story')}><ListTodo className="mr-2 h-4 w-4" /> Story Generator</Button>
      </div>
      {mode === 'bulk' && <BulkImportSection />}
      {mode === 'feature' && <FeatureBreakdownSection />}
      {mode === 'story' && <StoryGeneratorSection />}
    </div>
  );
};
