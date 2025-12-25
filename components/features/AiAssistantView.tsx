
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { db } from '../../firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button, Card, CardHeader, CardTitle, CardContent, Textarea, Label, Input, Badge } from '../ui';
import { Loader2, FileText, Sparkles, Trash2, AlertCircle, ListTodo } from 'lucide-react';
import { ProductBacklog } from '../../types';

// Types for Generated Content
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

// Helper to sanitize data before sending to Firestore
const sanitizeString = (str: any): string => (str && typeof str === 'string' ? str : "");
const sanitizePriority = (p: any): 'Low' | 'Medium' | 'High' => {
  const valid = ['Low', 'Medium', 'High'];
  
  if (typeof p === 'string') {
     const up = p.toUpperCase();
     if (up === 'P1' || up.includes('P1')) return 'High';
     if (up === 'P2' || up.includes('P2')) return 'Medium';
     if (up.includes('P3') || up === 'P4') return 'Low';
     if (up.includes('بالا') || up.includes('HIGH')) return 'High';
     if (up.includes('متوسط') || up.includes('MEDIUM')) return 'Medium';
     if (up.includes('پایین') || up.includes('LOW')) return 'Low';
  }

  if (p && valid.includes(p)) return p as 'Low' | 'Medium' | 'High';
  if (p && typeof p === 'string') {
    const capitalized = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    if (valid.includes(capitalized)) return capitalized as 'Low' | 'Medium' | 'High';
  }
  return 'Medium';
};
const sanitizeNumber = (n: any): number => (typeof n === 'number' && !isNaN(n) ? n : 1);

const cleanJson = (text: string) => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return match[1];
  return text.trim();
};

export const AiAssistantView = () => {
  const [mode, setMode] = useState<'bulk' | 'feature' | 'story'>('bulk');

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b pb-4 overflow-x-auto">
        <Button 
          variant={mode === 'bulk' ? 'default' : 'ghost'} 
          onClick={() => setMode('bulk')}
        >
          <FileText className="mr-2 h-4 w-4" /> Bulk Import
        </Button>
        <Button 
          variant={mode === 'feature' ? 'default' : 'ghost'} 
          onClick={() => setMode('feature')}
        >
          <Sparkles className="mr-2 h-4 w-4" /> Feature Breakdown (Backlogs)
        </Button>
        <Button 
          variant={mode === 'story' ? 'default' : 'ghost'} 
          onClick={() => setMode('story')}
        >
          <ListTodo className="mr-2 h-4 w-4" /> Story Generator
        </Button>
      </div>

      {mode === 'bulk' && <BulkImportSection />}
      {mode === 'feature' && <FeatureBreakdownSection />}
      {mode === 'story' && <StoryGeneratorSection />}
    </div>
  );
};

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
      reader.onload = (e) => {
        setText(e.target?.result as string);
      };
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
        contents: `Analyze the following requirement document.
        Document Content:
        ${text.slice(0, 50000)}`,
        config: {
          systemInstruction: `You are an expert Agile Product Owner assistant. Return JSON.`,
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
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (response.text) {
        setGeneratedData(JSON.parse(cleanJson(response.text)));
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      alert("Failed to generate content.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!generatedData) return;
    setImporting(true);
    const now = Date.now();
    try {
      const operations: ((batch: any) => void)[] = [];
      for (const backlog of generatedData.backlogs) {
        const backlogRef = doc(collection(db, "product_backlogs"));
        operations.push((batch) => {
          batch.set(backlogRef, {
            title: sanitizeString(backlog.title) || "Imported Backlog",
            description: sanitizeString(backlog.description),
            displayId: sanitizeString(backlog.displayId),
            role: sanitizeString(backlog.role),
            priority: sanitizePriority(backlog.priority),
            panel: selectedPanel,
            createdAt: now
          });
        });
        if (backlog.stories && backlog.stories.length > 0) {
            for (const story of backlog.stories) {
              const storyRef = doc(collection(db, `product_backlogs/${backlogRef.id}/user_stories`));
              operations.push((batch) => {
                batch.set(storyRef, {
                  backlogId: backlogRef.id,
                  displayId: sanitizeString(story.displayId),
                  title: sanitizeString(story.title) || "Untitled Story",
                  description: sanitizeString(story.description),
                  priority: sanitizePriority(story.priority),
                  points: sanitizeNumber(story.points),
                  panel: selectedPanel,
                  createdAt: now
                });
              });
            }
        }
      }
      const BATCH_SIZE = 400;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = operations.slice(i, i + BATCH_SIZE);
        chunk.forEach(op => op(batch));
        await batch.commit();
      }
      alert("Imported successfully.");
      setGeneratedData(null);
      setText("");
    } catch (e) {
      console.error(e);
      alert("Error importing data.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="h-fit">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Input Requirements</CardTitle>
          {text && <Button variant="ghost" size="sm" onClick={() => setText("")}><Trash2 className="h-4 w-4" /></Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Panel (Target System)</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPanel} onChange={(e) => setSelectedPanel(e.target.value as any)}>
               <option value="Admin">Admin Panel</option>
               <option value="Customer">Customer Panel</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Upload File</Label>
            <Input type="file" accept=".md,.txt" onChange={handleFileChange} />
          </div>
          <div className="space-y-2">
            <Label>Paste Content</Label>
            <Textarea className="min-h-[300px]" placeholder="Paste content here..." value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <Button onClick={handleAnalyze} disabled={loading || !text} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Analyze with AI"}
          </Button>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle>Preview & Import</CardTitle></CardHeader>
        <CardContent>
          {!generatedData ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground border-2 border-dashed rounded-lg">
              <FileText className="h-10 w-10 mb-2 opacity-50" />
              <p>Generated content will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
                {generatedData.backlogs.map((bl, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-2 bg-secondary/20">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-gray-100 px-1 rounded text-gray-600">{sanitizeString(bl.displayId)}</span>
                            <h3 className="font-bold text-lg">{sanitizeString(bl.title)}</h3>
                            <Badge variant="outline">{selectedPanel}</Badge>
                        </div>
                        {bl.priority && <Badge variant="outline">{sanitizePriority(bl.priority)}</Badge>}
                     </div>
                    {bl.role && <div className="text-xs font-semibold text-primary">Role: {sanitizeString(bl.role)}</div>}
                    <p className="text-sm text-muted-foreground">{sanitizeString(bl.description)}</p>
                  </div>
                ))}
              </div>
              <Button onClick={handleImport} disabled={importing} className="w-full" variant="default">
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm & Import"}
              </Button>
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
        contents: `Workflow Description: ${featureDescription}`,
        config: {
          systemInstruction: "You are an expert Agile Product Owner. Create Product Backlogs in Farsi. Return JSON.",
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
                  }
                }
              }
            }
          }
        }
      });
      if (response.text) {
        const data = JSON.parse(cleanJson(response.text));
        if (data.backlogs) setGeneratedBacklogs(data.backlogs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (generatedBacklogs.length === 0) return;
    setSaving(true);
    const now = Date.now();
    try {
      const batch = writeBatch(db);
      generatedBacklogs.forEach(bl => {
        const newDocRef = doc(collection(db, "product_backlogs"));
        batch.set(newDocRef, {
          title: sanitizeString(bl.title),
          description: sanitizeString(bl.description),
          priority: sanitizePriority(bl.priority),
          role: sanitizeString(bl.role),
          displayId: sanitizeString(bl.displayId),
          panel: selectedPanel,
          createdAt: now
        });
      });
      await batch.commit();
      setGeneratedBacklogs([]);
      setFeatureDescription("");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Feature Description</CardTitle></CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-2">
            <Label>Panel (Target System)</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPanel} onChange={(e) => setSelectedPanel(e.target.value as any)}>
               <option value="Admin">Admin Panel</option>
               <option value="Customer">Customer Panel</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Description (Farsi)</Label>
            <Textarea className="min-h-[200px] text-right" dir="rtl" placeholder="Describe requirements..." value={featureDescription} onChange={(e) => setFeatureDescription(e.target.value)} />
          </div>
          <Button onClick={handleGenerate} disabled={loading || !featureDescription} className="w-full">
             {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Generate Backlogs"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Suggested Backlogs</CardTitle></CardHeader>
        <CardContent>
           {generatedBacklogs.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground border-2 border-dashed rounded-lg">
              <Sparkles className="h-10 w-10 mb-2 opacity-50" />
              <p>Generated content will appear here</p>
            </div>
           ) : (
             <div className="space-y-4">
               <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                 {generatedBacklogs.map((bl, i) => (
                    <div key={i} className="border rounded p-3 bg-white">
                      <div className="flex justify-between items-start mb-1 text-right" dir="rtl">
                         <span className="font-semibold text-sm">{sanitizeString(bl.title)}</span>
                         {bl.displayId && <Badge variant="outline">{sanitizeString(bl.displayId)}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 text-right" dir="rtl">{sanitizeString(bl.description)}</p>
                    </div>
                 ))}
               </div>
               <Button onClick={handleSave} disabled={saving} className="w-full">Confirm & Create</Button>
             </div>
           )}
        </CardContent>
      </Card>
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
    const fetch = async () => {
      const snap = await getDocs(collection(db, "product_backlogs"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductBacklog));
      setBacklogs(data);
    };
    fetch();
  }, []);

  const handleGenerate = async () => {
    if (!workflowDescription || !selectedBacklogId) return;
    setLoading(true);
    const selectedBacklog = backlogs.find(b => b.id === selectedBacklogId);
    const contextPrompt = selectedBacklog 
      ? `Parent Backlog Context: Title: "${selectedBacklog.title}", Description: "${selectedBacklog.description}", Role: "${selectedBacklog.role || 'User'}"` 
      : "";
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Workflow: ${workflowDescription} \n ${contextPrompt}`,
        config: {
          systemInstruction: "You are an expert Agile Product Owner. Generate User Stories in Farsi. Return JSON.",
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
                  }
                }
              }
            }
          }
        }
      });
      if (response.text) {
        const data = JSON.parse(cleanJson(response.text));
        if (data.stories) setGeneratedStories(data.stories);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (generatedStories.length === 0 || !selectedBacklogId) return;
    setSaving(true);
    const parentBacklog = backlogs.find(b => b.id === selectedBacklogId);
    const inheritedPanel = parentBacklog?.panel || 'Admin';
    const now = Date.now();
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, `product_backlogs/${selectedBacklogId}/user_stories`);
      generatedStories.forEach(story => {
        const newDocRef = doc(collectionRef);
        batch.set(newDocRef, {
          backlogId: selectedBacklogId,
          title: sanitizeString(story.title),
          description: sanitizeString(story.description),
          priority: sanitizePriority(story.priority),
          points: sanitizeNumber(story.points),
          displayId: sanitizeString(story.displayId),
          panel: inheritedPanel,
          createdAt: now
        });
      });
      await batch.commit();
      setGeneratedStories([]);
      setWorkflowDescription("");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Story Generator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-2">
            <Label>Select Parent Backlog</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedBacklogId} onChange={(e) => setSelectedBacklogId(e.target.value)}>
              <option value="">-- Select a Backlog --</option>
              {backlogs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Workflow (Farsi)</Label>
            <Textarea className="min-h-[200px] text-right" dir="rtl" placeholder="Describe workflow..." value={workflowDescription} onChange={(e) => setWorkflowDescription(e.target.value)} />
          </div>
          <Button onClick={handleGenerate} disabled={loading || !workflowDescription || !selectedBacklogId} className="w-full">
             {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Generate Stories"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Generated Stories</CardTitle></CardHeader>
        <CardContent>
           {generatedStories.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground border-2 border-dashed rounded-lg">
              <ListTodo className="h-10 w-10 mb-2 opacity-50" />
              <p>Generated content will appear here</p>
            </div>
           ) : (
             <div className="space-y-4">
               <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                 {generatedStories.map((s, i) => (
                    <div key={i} className="border rounded p-3 bg-white text-right" dir="rtl">
                      <div className="flex justify-between items-start mb-1">
                         <span className="font-semibold text-sm">{sanitizeString(s.title)}</span>
                         <Badge variant="outline">{sanitizeNumber(s.points)} pts</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{sanitizeString(s.description)}</p>
                    </div>
                 ))}
               </div>
               <Button onClick={handleSave} disabled={saving} className="w-full">Confirm & Save</Button>
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
};
