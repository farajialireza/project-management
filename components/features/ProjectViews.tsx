
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Badge, Card, CardHeader, CardTitle, CardContent, Textarea } from '../ui';
import { ProductBacklog, UserStory, Milestone, Task, Team, User, TaskComment, AssignmentHistory, SubTask } from '../../types';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, ListTodo, Sparkles, MessageSquare, History, User as UserIcon, Users as UsersIcon, Clock, Loader2, CheckCircle, Save, X, Filter, Search, Calendar, Layout, BarChart3, FileText, Info, UserPlus, Users, GripVertical, CheckSquare, Square, MoreVertical, ExternalLink, Milestone as MilestoneIcon } from 'lucide-react';
import { useAuth } from '../../App';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI, Type } from "@google/genai";
import { backlogsApi, storiesApi, tasksApi, milestonesApi } from '../../api/project';
import { usersApi, teamsApi } from '../../api/admin';

// --- Helpers ---
const cleanJson = (text: string) => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return match[1];
  return text.trim();
};

const ProgressBar = ({ progress, className = "" }: { progress: number, className?: string }) => (
  <div className={`w-full bg-gray-100 rounded-full h-2 overflow-hidden ${className}`}>
    <div 
      className={`h-full transition-all duration-700 ease-out ${progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-primary' : 'bg-amber-500'}`} 
      style={{ width: `${progress}%` }}
    />
  </div>
);

// --- Backlogs View ---
export const BacklogsView = () => {
  const { user } = useAuth();
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue } = useForm<ProductBacklog>();

  const [filterPanel, setFilterPanel] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');

  const fetchBacklogs = async () => {
    try {
      setLoading(true);
      const data = await backlogsApi.getAll();
      setBacklogs(data);
    } catch (error) {
      console.error("Error fetching backlogs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBacklogs(); }, []);

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!id || deletingId) return;

    const confirmMessage = "آیا مطمئن هستید؟ با حذف این بکلگ، تمام یوزر استوری‌ها و تسک‌های مرتبط با آن نیز برای همیشه پاک خواهند شد.";
    if (!window.confirm(confirmMessage)) return;

    setDeletingId(id);
    try {
      await backlogsApi.delete(id);
      setBacklogs(prev => prev.filter(b => b.id !== id));
    } catch (error: any) {
      console.error("Critical error during backlog deletion:", error);
      alert("خطا در حذف بکلگ: " + (error.message || "خطای ناشناخته"));
    } finally {
      setDeletingId(null);
    }
  };

  const onEdit = (bl: ProductBacklog, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(bl.id);
    setValue('title', bl.title);
    setValue('description', bl.description);
    setValue('displayId', bl.displayId);
    setValue('role', bl.role);
    setValue('priority', bl.priority);
    setValue('panel', bl.panel || 'Admin');
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    try {
      const payload = editingId ? { ...data, id: editingId } : data;
      await backlogsApi.save(payload);
      setIsDialogOpen(false);
      reset();
      setEditingId(null);
      fetchBacklogs();
    } catch (error: any) {
      console.error("Error saving backlog:", error);
      alert("خطا در ذخیره‌سازی: " + (error.message || "خطای ناشناخته"));
    }
  };

  const openNew = () => {
    setEditingId(null);
    reset();
    setValue('panel', 'Admin');
    setIsDialogOpen(true);
  };

  const filteredBacklogs = backlogs.filter(bl => {
    const p = bl.panel || 'Admin';
    const matchPanel = filterPanel === 'All' || p === filterPanel;
    const matchPriority = filterPriority === 'All' || bl.priority === filterPriority;
    return matchPanel && matchPriority;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Product Backlogs</h2>
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1 shadow-sm">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select 
                    className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer"
                    value={filterPanel}
                    onChange={(e) => setFilterPanel(e.target.value)}
                >
                    <option value="All">All Panels</option>
                    <option value="Admin">Admin</option>
                    <option value="Customer">Customer</option>
                </select>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <select 
                    className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                >
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
            </div>
            {user?.isAdmin && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Backlog</Button>}
        </div>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead className="w-[100px]">Panel</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Description</TableHead>
              {user?.isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               Array.from({ length: 5 }).map((_, i) => (
                 <TableRow key={i} className="animate-pulse">
                   <TableCell colSpan={7} className="h-12 bg-slate-50/50" />
                 </TableRow>
               ))
            ) : filteredBacklogs.map(bl => (
              <TableRow key={bl.id}>
                <TableCell className="font-mono text-xs">{bl.displayId || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={bl.panel === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                    {bl.panel || 'Admin'}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{bl.title}</TableCell>
                <TableCell>{bl.role || '-'}</TableCell>
                <TableCell>
                  {bl.priority && (
                    <Badge variant={bl.priority === 'High' ? 'destructive' : bl.priority === 'Medium' ? 'default' : 'secondary'}>
                      {bl.priority}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[300px] truncate text-muted-foreground" title={bl.description}>{bl.description}</TableCell>
                 {user?.isAdmin && (
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => onEdit(bl, e)} 
                        disabled={deletingId === bl.id}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive" 
                        onClick={(e) => onDelete(bl.id, e)}
                        disabled={deletingId === bl.id}
                      >
                        {deletingId === bl.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!loading && filteredBacklogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground italic">
                  No backlogs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader><DialogTitle>{editingId ? "Edit" : "Create"} Product Backlog</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Display ID</Label>
               <Input {...register('displayId')} placeholder="e.g. PB-001" />
             </div>
             <div className="space-y-2">
                <Label>Panel</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('panel')}>
                  <option value="Admin">Admin</option>
                  <option value="Customer">Customer</option>
                </select>
             </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register('title', { required: true })} placeholder="e.g. Admin Panel" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...register('description')} placeholder="Description..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Role</Label>
                <Input {...register('role')} placeholder="e.g. Admin" />
            </div>
            <div className="space-y-2">
                <Label>Priority</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('priority')}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">{editingId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};

// --- Shared Task Detail Modal ---
const TaskDetailModal = ({ task, isOpen, onClose, onUpdate, onDelete, teams, usersList, allStories }: { task: Task | null, isOpen: boolean, onClose: () => void, onUpdate: (t: Task) => void, onDelete: (id: string) => void, teams: Team[], usersList: User[], allStories: UserStory[] }) => {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Task>>({});
    const [newSubTask, setNewSubTask] = useState("");
    const [aiSubLoading, setAiSubLoading] = useState(false);
    
    const teamLeaderId = task?.teamId ? teams.find(t => t.id === task.teamId)?.leaderId : null;
    const canEdit = user?.isAdmin || (user && teamLeaderId === user.id);
    const parentStory = allStories.find(s => s.id === task?.userStoryId);

    useEffect(() => {
        if (task) {
            setEditForm({
                title: task.title,
                description: task.description,
                stack: task.stack,
                teamId: task.teamId || '',
                assigneeId: task.assigneeId || ''
            });
            setIsEditing(false);
            setNewSubTask("");
        }
    }, [task, isOpen]);

    if (!task) return null;

    const updateStatus = async (newStatus: Task['status']) => {
        if (!user) return;
        const now = Date.now();
        const updates: Partial<Task> = { 
            status: newStatus,
            history: [...(task.history || []), { status: newStatus, timestamp: now, userId: user.id, userName: user.name }]
        };

        if (newStatus === 'In Progress' && !task.startTime) updates.startTime = now;
        if (newStatus === 'Done') updates.endTime = now;
        
        try {
          await tasksApi.updateStatus(task.id, updates);
          onUpdate({ ...task, ...updates } as Task);
        } catch (error: any) {
          console.error("Status update failed:", error);
          alert("Failed to update status: " + (error.message || "Unknown error"));
        }
    };

    const handleSaveEdit = async () => {
        if (!user) return;
        try {
            const now = Date.now();
            const newAssignmentHistory: AssignmentHistory[] = [...(task.assignmentHistory || [])];

            if (editForm.teamId !== task.teamId) {
                const newTeamName = editForm.teamId ? (teams.find(t => t.id === editForm.teamId)?.name || 'Unknown Team') : 'Unassigned (None)';
                newAssignmentHistory.push({
                    type: 'Team', assignedToId: editForm.teamId || '', assignedToName: newTeamName,
                    assignedById: user.id, assignedByName: user.name, timestamp: now
                });
            }

            if (editForm.assigneeId !== task.assigneeId) {
                const newMemberName = editForm.assigneeId ? (usersList.find(u => u.id === editForm.assigneeId)?.name || 'Unknown User') : 'Unassigned (None)';
                newAssignmentHistory.push({
                    type: 'Member', assignedToId: editForm.assigneeId || '', assignedToName: newMemberName,
                    assignedById: user.id, assignedByName: user.name, timestamp: now
                });
            }

            const updates = {
                ...editForm,
                id: task.id,
                assignmentHistory: newAssignmentHistory,
                lastEditedBy: { userId: user.id, userName: user.name, timestamp: now }
            };
            const updatedTask = await tasksApi.save(updates);
            onUpdate(updatedTask);
            setIsEditing(false);
        } catch (error: any) {
            console.error("Update failed:", error);
            alert("Failed to update task: " + (error.message || "Unknown error"));
        }
    };

    const toggleSubTask = async (id: string) => {
        const updatedSubtasks = task.subtasks?.map(st => 
            st.id === id ? { ...st, isDone: !st.isDone } : st
        ) || [];
        try {
          await tasksApi.updateStatus(task.id, { subtasks: updatedSubtasks });
          onUpdate({ ...task, subtasks: updatedSubtasks });
        } catch (error: any) {
          alert("Failed to update subtask: " + (error.message || "Unknown error"));
        }
    };

    const addManualSubTask = async () => {
        if (!newSubTask.trim()) return;
        const sub: SubTask = {
            id: Math.random().toString(36).substr(2, 9),
            title: newSubTask.trim(),
            isDone: false
        };
        const updated = [...(task.subtasks || []), sub];
        try {
          await tasksApi.updateStatus(task.id, { subtasks: updated });
          onUpdate({ ...task, subtasks: updated });
          setNewSubTask("");
        } catch (error: any) {
          alert("Failed to add subtask: " + (error.message || "Unknown error"));
        }
    };

    const removeSubTask = async (id: string) => {
        const updated = task.subtasks?.filter(st => st.id !== id) || [];
        try {
          await tasksApi.updateStatus(task.id, { subtasks: updated });
          onUpdate({ ...task, subtasks: updated });
        } catch (error: any) {
          alert("Failed to remove subtask: " + (error.message || "Unknown error"));
        }
    };

    const generateAiSubtasks = async () => {
        setAiSubLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Break this task into 3-6 practical subtasks for a checklist. Farsi. Return JSON array.
                Title: ${task.title}
                Desc: ${task.description}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: { steps: { type: Type.ARRAY, items: { type: Type.STRING } } }
                    }
                }
            });
            const data = JSON.parse(cleanJson(response.text || "{}"));
            if (data.steps) {
                const newSubs: SubTask[] = data.steps.map((s: string) => ({
                    id: Math.random().toString(36).substr(2, 9), title: s, isDone: false
                }));
                const updated = [...(task.subtasks || []), ...newSubs];
                await tasksApi.updateStatus(task.id, { subtasks: updated });
                onUpdate({ ...task, subtasks: updated });
            }
        } catch (e: any) {
            console.error(e);
            alert("AI subtask generation failed: " + (e.message || "Unknown error"));
        } finally {
            setAiSubLoading(false);
        }
    };

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this task?")) {
            try {
                await tasksApi.delete(task.id);
                onDelete(task.id);
                onClose();
            } catch (error: any) {
                console.error("Delete failed:", error);
                alert("Failed to delete task: " + (error.message || "Unknown error"));
            }
        }
    };

    const addComment = async (text: string) => {
        if (!user || !text.trim()) return;
        const newComment: TaskComment = {
            id: Math.random().toString(36).substr(2, 9),
            userId: user.id, userName: user.name, text, timestamp: Date.now()
        };
        const updatedComments = [...(task.comments || []), newComment];
        try {
          await tasksApi.updateStatus(task.id, { comments: updatedComments });
          onUpdate({ ...task, comments: updatedComments });
        } catch (error: any) {
          alert("Failed to add comment: " + (error.message || "Unknown error"));
        }
    };

    const watchTeamId = editForm.teamId;
    const availableMembers = watchTeamId
      ? usersList.filter(u => teams.find(t => t.id === watchTeamId)?.memberIds.includes(u.id))
      : usersList;

    return (
        <Dialog open={isOpen} onOpenChange={(v) => { if(!v) onClose(); }}>
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b flex justify-between items-start bg-slate-50">
                        <div className="space-y-1 flex-1 mr-4">
                            <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant="outline">{task.panel}</Badge>
                                {!isEditing && <Badge variant="secondary">{task.stack}</Badge>}
                                {parentStory && (
                                   <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                                      <Layout className="h-3 w-3" />
                                      {parentStory.displayId ? `${parentStory.displayId}: ` : ''}{parentStory.title}
                                   </Badge>
                                )}
                            </div>
                            {isEditing ? (
                                <Input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="font-bold text-lg" />
                            ) : (
                                <h2 className="text-xl font-bold">{task.title}</h2>
                            )}
                            <div className="text-sm text-muted-foreground flex gap-4 pt-1">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                             <div className="flex items-center gap-2">
                                {canEdit && !isEditing && (
                                    <>
                                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Edit Task"><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={handleDelete} title="Delete Task"><Trash2 className="h-4 w-4" /></Button>
                                    </>
                                )}
                                {isEditing && (
                                    <>
                                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} title="Cancel"><X className="h-4 w-4" /></Button>
                                        <Button variant="default" size="icon" className="bg-green-600 hover:bg-green-700" onClick={handleSaveEdit} title="Save"><Save className="h-4 w-4" /></Button>
                                    </>
                                )}
                            </div>
                            <select 
                                value={task.status} onChange={(e) => updateStatus(e.target.value as any)}
                                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-sm"
                            >
                                {['To Do', 'In Progress', 'Testing', 'Review', 'Done'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row">
                        <div className="flex-1 p-6 space-y-8 border-r">
                             <div className="space-y-6">
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <FileText className="h-4 w-4" /> Task Description (Markdown)
                                        </Label>
                                        <Textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="min-h-[250px]" />
                                    </div>
                                ) : (
                                    <div className="prose prose-sm max-w-none">
                                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3"><FileText className="h-4 w-4" /> Task Description</h3>
                                        <div className="markdown-body p-4 bg-slate-50 rounded-lg border min-h-[120px]" dir="auto">
                                            <ReactMarkdown>{task.description || "*No task description provided.*"}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                             </div>

                             <div className="space-y-4 pt-4 border-t">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                        <CheckSquare className="h-4 w-4"/> Checklist / Subtasks
                                        {task.subtasks && task.subtasks.length > 0 && (
                                            <span className="text-xs bg-slate-200 px-1.5 rounded-full font-bold">
                                                {task.subtasks.filter(s => s.isDone).length}/{task.subtasks.length}
                                            </span>
                                        )}
                                    </h3>
                                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={generateAiSubtasks} disabled={aiSubLoading}>
                                        {aiSubLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : <Sparkles className="h-3 w-3 text-purple-600"/>}
                                        AI Breakdown
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {task.subtasks?.map(st => (
                                        <div key={st.id} className="flex items-center group gap-2 p-2 hover:bg-slate-50 rounded-md border border-transparent hover:border-slate-100 transition-colors">
                                            <button onClick={() => toggleSubTask(st.id)} className="text-slate-400 hover:text-primary transition-colors">
                                                {st.isDone ? <CheckSquare className="h-5 w-5 text-green-600"/> : <Square className="h-5 w-5"/>}
                                            </button>
                                            <span className={`flex-1 text-sm transition-all ${st.isDone ? 'line-through text-slate-400' : 'text-slate-700'}`} dir="auto">{st.title}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => removeSubTask(st.id)}>
                                                <Trash2 className="h-3 w-3"/>
                                            </Button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2 items-center pt-2">
                                        <Input placeholder="Add a step manually..." value={newSubTask} onChange={e => setNewSubTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addManualSubTask()} className="h-9 text-sm" />
                                        <Button variant="secondary" size="sm" className="h-9" onClick={addManualSubTask}><Plus className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                             </div>

                             {parentStory && (
                                <div className="bg-blue-50/50 rounded-lg border border-blue-100 overflow-hidden">
                                   <div className="bg-blue-100/50 px-3 py-1.5 flex items-center gap-2 border-b border-blue-100">
                                      <Info className="h-4 w-4 text-blue-600" />
                                      <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">User Story Context</span>
                                   </div>
                                   <div className="p-4 space-y-2">
                                      <h4 className="font-bold text-blue-900 text-sm">{parentStory.title}</h4>
                                      <div className="prose prose-sm max-w-none text-blue-800/80 italic text-xs leading-relaxed" dir="auto">
                                         <ReactMarkdown>{parentStory.description || "*No description provided for this story.*"}</ReactMarkdown>
                                      </div>
                                   </div>
                                </div>
                             )}

                             <div className="space-y-4 pt-4 border-t">
                                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4"/> Comments</h3>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                    {task.comments?.map(c => (
                                        <div key={c.id} className="bg-slate-50 p-3 rounded-lg text-sm space-y-1 border border-slate-100">
                                            <div className="flex justify-between">
                                                <span className="font-semibold">{c.userName}</span>
                                                <span className="text-xs text-muted-foreground">{new Date(c.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p>{c.text}</p>
                                        </div>
                                    ))}
                                    {(!task.comments || task.comments.length === 0) && <p className="text-sm text-muted-foreground italic">No comments yet.</p>}
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder="Write a comment..." id={`comment-input-${task.id}`} onKeyDown={(e) => {
                                        if(e.key === 'Enter') {
                                            addComment(e.currentTarget.value);
                                            e.currentTarget.value = '';
                                        }
                                    }}/>
                                    <Button size="sm" onClick={() => {
                                        const el = document.getElementById(`comment-input-${task.id}`) as HTMLInputElement;
                                        addComment(el.value); el.value = '';
                                    }}>Send</Button>
                                </div>
                             </div>
                        </div>

                        <div className="w-full md:w-80 bg-slate-50 p-4 space-y-6 text-sm overflow-y-auto">
                            <div className="space-y-3">
                                <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight">Assignments & Stack</span>
                                {isEditing ? (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Stack</Label>
                                            <select className="w-full h-8 rounded border text-xs px-2" value={editForm.stack} onChange={e => setEditForm({...editForm, stack: e.target.value as any})}>
                                                <option value="Frontend">Frontend</option>
                                                <option value="Backend">Backend</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Team</Label>
                                            <select className="w-full h-8 rounded border text-xs px-2" value={editForm.teamId} onChange={e => setEditForm({...editForm, teamId: e.target.value, assigneeId: ''})}>
                                                <option value="">-- None --</option>
                                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Assignee</Label>
                                            <select className="w-full h-8 rounded border text-xs px-2" value={editForm.assigneeId} onChange={e => setEditForm({...editForm, assigneeId: e.target.value})}>
                                                <option value="">-- Unassigned --</option>
                                                {availableMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-white p-3 rounded-lg border shadow-sm">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Team</div>
                                            <div className="font-medium flex items-center gap-2"><UsersIcon className="h-3.5 w-3.5 text-primary" />{teams.find(t => t.id === task.teamId)?.name || 'None'}</div>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border shadow-sm">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Assignee</div>
                                            <div className="font-medium flex items-center gap-2"><UserIcon className="h-3.5 w-3.5 text-primary" />{usersList.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}</div>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div className="space-y-3">
                                <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight">Assignment History</span>
                                <div className="space-y-3">
                                    {task.assignmentHistory?.slice().reverse().map((ah, i) => (
                                        <div key={i} className="text-xs bg-white p-3 rounded-lg border border-slate-100 shadow-sm space-y-1 relative">
                                            <div className="flex items-center gap-2 mb-1">
                                                {ah.type === 'Team' ? <Users className="h-3 w-3 text-purple-600" /> : <UserPlus className="h-3 w-3 text-blue-600" />}
                                                <span className="font-bold text-slate-800">{ah.assignedToName}</span>
                                            </div>
                                            <div className="flex flex-col text-[10px] text-muted-foreground">
                                                <span>Assigned by: <b>{ah.assignedByName}</b></span>
                                                <span className="mt-0.5"><Clock className="h-2.5 w-2.5 inline" /> {new Date(ah.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight">Audit</span>
                                <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border shadow-sm space-y-2">
                                    {task.createdBy && (
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Created by</div>
                                            <div className="font-medium">{task.createdBy.userName}</div>
                                            <div className="text-[10px] text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</div>
                                        </div>
                                    )}
                                    {task.lastEditedBy && (
                                        <div className="pt-2 border-t">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Last edited by</div>
                                            <div className="font-medium">{task.lastEditedBy.userName}</div>
                                            <div className="text-[10px] text-muted-foreground">{new Date(task.lastEditedBy.timestamp).toLocaleString()}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight">Lifecycle History</span>
                                <div className="space-y-4 relative border-l-2 ml-2 pl-4 py-1 border-slate-200">
                                    {task.history?.slice().reverse().map((h, i) => (
                                        <div key={i} className="relative text-xs">
                                            <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-white border-2 border-primary"></div>
                                            <div className="font-bold text-slate-900">{h.status}</div>
                                            <div className="text-muted-foreground font-medium flex items-center gap-1"><UserIcon className="h-2.5 w-2.5" /> {h.userName}</div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {new Date(h.timestamp).toLocaleString()}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

// --- Progress Calculation ---
const calculateStoryProgress = (tasks: Task[]) => {
  if (!tasks || tasks.length === 0) return 0;
  const doneCount = tasks.filter(t => t.status === 'Done').length;
  return Math.round((doneCount / tasks.length) * 100);
};

// --- Stories View (Hierarchical) ---
export const StoriesView = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<(UserStory & { backlogTitle?: string })[]>([]);
  const [tasksCache, setTasksCache] = useState<Record<string, Task[]>>({}); 
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({});
  
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [isStoryDialogOpen, setIsStoryDialogOpen] = useState(false);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [targetStory, setTargetStory] = useState<UserStory | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const [aiLoading, setAiLoading] = useState(false);
  
  const { register: regStory, handleSubmit: subStory, reset: resetStory, setValue: setValueStory } = useForm<UserStory>();
  const { register: regTask, handleSubmit: subTask, reset: resetTask, watch: watchTask, setValue: setValueTask } = useForm<Task>();

  const [filterBacklog, setFilterBacklog] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterPanel, setFilterPanel] = useState<string>('All');

  const fetchData = async () => {
    try {
        setLoading(true);
        const [bls, sts, tms, usrs] = await Promise.all([
            backlogsApi.getAll(),
            storiesApi.getAll(),
            teamsApi.getAll(),
            usersApi.getAll()
        ]);
        setBacklogs(bls);
        setStories(sts);
        setTeams(tms);
        setUsersList(usrs);
    } catch (e) {
        console.error("Error fetching data", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleStory = async (storyId: string) => {
    if (expandedStoryId === storyId) {
        setExpandedStoryId(null);
        return;
    }
    setExpandedStoryId(storyId);

    if (!tasksCache[storyId]) {
        setLoadingTasks(prev => ({ ...prev, [storyId]: true }));
        try {
            const loadedTasks = await tasksApi.getByStoryId(storyId);
            setTasksCache(prev => ({ ...prev, [storyId]: loadedTasks }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingTasks(prev => ({ ...prev, [storyId]: false }));
        }
    }
  };

  const onSaveStory = async (data: any) => {
    try {
        const parentBacklog = backlogs.find(b => b.id === data.backlogId);
        const payload = {
            ...data,
            id: editingStoryId,
            panel: parentBacklog?.panel || 'Admin'
        };
        await storiesApi.save(payload);
        setIsStoryDialogOpen(false);
        resetStory();
        setEditingStoryId(null);
        fetchData();
    } catch (e: any) {
        alert("Failed to save story: " + (e.message || "Unknown error"));
    }
  };

  const onDeleteStory = async (story: UserStory, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm(`آیا مطمئن هستید که می‌خواهید استوری "${story.title}" را حذف کنید؟`)) {
        try {
            await storiesApi.delete(story.id);
            fetchData();
        } catch (err: any) { 
          console.error(err);
          alert("خطا در حذف استوری: " + (err.message || "Unknown error")); 
        }
    }
  };

  const onEditStory = (story: UserStory, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingStoryId(story.id);
      setValueStory('backlogId', story.backlogId);
      setValueStory('displayId', story.displayId);
      setValueStory('role', story.role);
      setValueStory('title', story.title);
      setValueStory('description', story.description);
      setValueStory('priority', story.priority);
      setValueStory('points', story.points);
      setIsStoryDialogOpen(true);
  };

  const openAddTask = (story: UserStory, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetStory(story);
    resetTask();
    setValueTask('stack', 'Frontend');
    setIsAddTaskDialogOpen(true);
  };

  const onAddTaskSubmit = async (data: any) => {
    if (!targetStory) return;
    const now = Date.now();
    const assignmentHistory: AssignmentHistory[] = [];

    if (data.teamId) {
        assignmentHistory.push({
            type: 'Team', assignedToId: data.teamId,
            assignedToName: teams.find(t => t.id === data.teamId)?.name || 'Team',
            assignedById: user?.id || 'system', assignedByName: user?.name || 'System', timestamp: now
        });
    }

    if (data.assigneeId) {
        assignmentHistory.push({
            type: 'Member', assignedToId: data.assigneeId,
            assignedToName: usersList.find(u => u.id === data.assigneeId)?.name || 'User',
            assignedById: user?.id || 'system', assignedByName: user?.name || 'System', timestamp: now
        });
    }

    const newTaskData: Partial<Task> = {
        title: data.title,
        description: data.description,
        status: 'To Do',
        userStoryId: targetStory.id,
        backlogId: targetStory.backlogId,
        panel: targetStory.panel || 'Admin',
        stack: data.stack,
        teamId: data.teamId || undefined,
        assigneeId: data.assigneeId || undefined,
        createdAt: now,
        history: [{ status: 'To Do', timestamp: now, userId: user?.id || 'system', userName: user?.name || 'System' }],
        assignmentHistory: assignmentHistory,
        comments: [],
        subtasks: [],
        createdBy: user ? { userId: user.id, userName: user.name } : { userId: 'system', userName: 'System' }
    };
    
    try {
      const newTask = await tasksApi.save(newTaskData);
      setTasksCache(prev => ({ ...prev, [targetStory.id]: [...(prev[targetStory.id] || []), newTask] }));
      setIsAddTaskDialogOpen(false);
      setExpandedStoryId(targetStory.id);
    } catch (e: any) {
      alert("Failed to create task: " + (e.message || "Unknown error"));
    }
  };

  const generateAiTasks = async () => {
    if (!targetStory) return;
    setAiLoading(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate logical tech tasks in Persian for Story: ${targetStory.title}. JSON output.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tasks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, stack: { type: Type.STRING } } } }
                    }
                }
            }
        });
        
        const generated = JSON.parse(cleanJson(response.text || "{}"));
        if (generated.tasks) {
            const now = Date.now();
            const newTasksPayload = generated.tasks.map((t: any) => ({
                title: t.title, description: t.description, status: 'To Do' as const,
                userStoryId: targetStory.id, backlogId: targetStory.backlogId, panel: targetStory.panel || 'Admin',
                stack: t.stack, createdAt: now,
                history: [{ status: 'To Do', timestamp: now, userId: user?.id || 'ai', userName: user?.name || 'AI Assistant' }],
                createdBy: { userId: user?.id || 'ai', userName: user?.name || 'AI Assistant' }
            }));
            await tasksApi.bulkSave(newTasksPayload);
            const refetchedTasks = await tasksApi.getByStoryId(targetStory.id);
            setTasksCache(prev => ({ ...prev, [targetStory.id]: refetchedTasks }));
            setExpandedStoryId(targetStory.id);
            setIsAddTaskDialogOpen(false);
        }
    } catch (e: any) {
        console.error(e);
        alert("AI Generation failed: " + (e.message || "Unknown error"));
    } finally {
        setAiLoading(false);
    }
  };

  const watchTeam = watchTask('teamId');
  const availableMembers = watchTeam 
      ? usersList.filter(u => teams.find(t => t.id === watchTeam)?.memberIds.includes(u.id))
      : [];

  const filteredStories = stories.filter(story => {
    const matchBacklog = filterBacklog === 'All' || story.backlogId === filterBacklog;
    const matchPriority = filterPriority === 'All' || story.priority === filterPriority;
    const matchPanel = filterPanel === 'All' || story.panel === filterPanel;
    return matchBacklog && matchPriority && matchPanel;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">User Stories</h2>
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1 shadow-sm overflow-x-auto max-w-full">
                <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <select 
                    className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer max-w-[150px] truncate"
                    value={filterBacklog}
                    onChange={(e) => setFilterBacklog(e.target.value)}
                >
                    <option value="All">All Backlogs</option>
                    {backlogs.map(b => <option key={b.id} value={b.id}>{b.displayId ? `${b.displayId} - ` : ''}{b.title}</option>)}
                </select>
                <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>
                <select className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer" value={filterPanel} onChange={(e) => setFilterPanel(e.target.value)}>
                    <option value="All">All Panels</option>
                    <option value="Admin">Admin</option>
                    <option value="Customer">Customer</option>
                </select>
                <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>
                <select className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
            </div>
            {user?.isAdmin && <Button onClick={() => { setEditingStoryId(null); resetStory(); setIsStoryDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Story</Button>}
        </div>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Backlog</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRow key={i} className="animate-pulse"><TableCell colSpan={6} className="h-12 bg-slate-50/50" /></TableRow>)
            ) : filteredStories.map(story => {
              const isExpanded = expandedStoryId === story.id;
              const isLoadingTasks = loadingTasks[story.id];
              const storyTasks = tasksCache[story.id] || [];
              const progress = calculateStoryProgress(storyTasks);
              
              return (
                <React.Fragment key={story.id}>
                  <TableRow className={isExpanded ? "bg-muted/50 border-b-0" : "cursor-pointer"} onClick={() => toggleStory(story.id)}>
                    <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell className="font-mono text-xs">{story.displayId || '-'}</TableCell>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                           {story.title}
                           {story.panel && <Badge variant="outline" className="text-[10px] h-5">{story.panel}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">{story.description}</div>
                    </TableCell>
                    <TableCell>{story.backlogTitle}</TableCell>
                    <TableCell className="w-[150px]">
                      {tasksCache[story.id] ? (
                        <div className="space-y-1">
                          <ProgressBar progress={progress} />
                          <div className="text-[10px] text-muted-foreground text-center font-medium">{progress}% ({storyTasks.filter(t => t.status === 'Done').length}/{storyTasks.length} tasks)</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 opacity-50"><Badge variant="outline" className="text-[10px]">{story.points} pts</Badge><div className="h-1 w-12 bg-gray-100 rounded"></div></div>
                      )}
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={(e) => openAddTask(story, e)}><ListTodo className="h-3 w-3 mr-2" /> Add Task</Button>
                            {user?.isAdmin && (
                                <>
                                <Button variant="ghost" size="icon" onClick={(e) => onEditStory(story, e)}><Edit2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => onDeleteStory(story, e)}><Trash2 className="h-4 w-4" /></Button>
                                </>
                            )}
                       </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6} className="p-0">
                        <div className="p-4 pl-12 space-y-2">
                           <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                             <ListTodo className="h-4 w-4" /> Tasks
                             {isLoadingTasks && <Loader2 className="h-3 w-3 animate-spin" />}
                             {!isLoadingTasks && ` (${storyTasks.length})`}
                           </h4>
                           {isLoadingTasks ? (
                               <div className="py-4 text-center text-sm text-muted-foreground">Loading tasks...</div>
                           ) : storyTasks.length === 0 ? (
                             <p className="text-xs text-muted-foreground italic">No tasks yet.</p>
                           ) : (
                             <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                               {storyTasks.map(task => (
                                 <div key={task.id} onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setIsTaskDetailOpen(true); }} className="cursor-pointer group relative flex flex-col gap-2 bg-background p-3 rounded-lg border hover:border-primary transition-colors shadow-sm">
                                   <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2"><Badge variant="secondary" className="text-[10px]">{task.stack}</Badge><Badge variant="outline" className="text-[10px]">{task.panel}</Badge></div>
                                      <Badge variant="outline" className={`text-[10px] ${task.status === 'Done' ? 'bg-green-100 text-green-700 border-green-200' : task.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}`}>{task.status}</Badge>
                                   </div>
                                   <span className="font-medium text-sm line-clamp-2" dir="auto">{task.title}</span>
                                   <div className="flex justify-between items-center text-xs text-muted-foreground mt-auto">
                                       <span className="flex items-center gap-1"><UserIcon className="h-3 w-3"/> {usersList.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}</span>
                                       {task.comments && task.comments.length > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3"/> {task.comments.length}</span>}
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isStoryDialogOpen} onOpenChange={setIsStoryDialogOpen}>
        <DialogHeader><DialogTitle>{editingStoryId ? "Edit" : "Create"} User Story</DialogTitle></DialogHeader>
        <form onSubmit={subStory(onSaveStory)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Backlog (Parent)</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" {...regStory('backlogId', { required: true })} disabled={!!editingStoryId}>
              <option value="">Select Backlog</option>
              {backlogs.map(b => <option key={b.id} value={b.id}>{b.title} ({b.panel || 'Admin'})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2"><Label>ID</Label><Input {...regStory('displayId')} placeholder="PB-001" /></div>
             <div className="space-y-2"><Label>Role</Label><Input {...regStory('role')} /></div>
          </div>
          <div className="space-y-2"><Label>Title</Label><Input {...regStory('title', { required: true })} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea {...regStory('description')} className="min-h-[150px]" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regStory('priority')}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Points</Label><Input type="number" {...regStory('points')} defaultValue={1} /></div>
          </div>
          <DialogFooter><Button type="submit">{editingStoryId ? "Update" : "Create"} Story</Button></DialogFooter>
        </form>
      </Dialog>

      <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
        <DialogHeader><DialogTitle>Add Task to: {targetStory?.title}</DialogTitle></DialogHeader>
        <div className="py-2">
            <Button variant="outline" className="w-full mb-4" onClick={generateAiTasks} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4 text-purple-600"/>}
                Auto-Generate Tasks with AI
            </Button>
            <form onSubmit={subTask(onAddTaskSubmit)} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input {...regTask('title', { required: true })} /></div>
                <div className="space-y-2"><Label>Description (Markdown)</Label><Textarea {...regTask('description')} placeholder="Supports Markdown..." /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Stack</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regTask('stack')}>
                            <option value="Frontend">Frontend</option><option value="Backend">Backend</option>
                        </select>
                    </div>
                    <div className="space-y-2"><Label>Inherited Panel</Label><Input disabled value={targetStory?.panel || 'Admin'} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Assign Team</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regTask('teamId')}><option value="">-- No Team --</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>Assign Member</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regTask('assigneeId')}><option value="">-- Unassigned --</option>{availableMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                </div>
                <DialogFooter><Button type="submit">Create Task</Button></DialogFooter>
            </form>
        </div>
      </Dialog>
      
      <TaskDetailModal 
        task={selectedTask} isOpen={isTaskDetailOpen} onClose={() => setIsTaskDetailOpen(false)} 
        onUpdate={(updated) => {
            setSelectedTask(updated);
            setTasksCache(prev => {
                const tasks = prev[updated.userStoryId] || [];
                return { ...prev, [updated.userStoryId]: tasks.map(t => t.id === updated.id ? updated : t) };
            });
        }}
        onDelete={(id) => {
             setTasksCache(prev => {
                 if (!selectedTask) return prev;
                 return { ...prev, [selectedTask.userStoryId]: (prev[selectedTask.userStoryId] || []).filter(t => t.id !== id) };
             });
             setIsTaskDetailOpen(false);
        }}
        teams={teams} usersList={usersList} allStories={stories}
      />
    </div>
  );
};

// --- Milestones View ---
export const MilestonesView = () => {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const { register, handleSubmit, reset, setValue } = useForm<Milestone>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ms, ts, sts] = await Promise.all([
        milestonesApi.getAll(),
        tasksApi.getAll(),
        storiesApi.getAll()
      ]);
      setMilestones(ms);
      setTasks(ts);
      setStories(sts);
    } catch (error) {
      console.error("Error fetching milestone data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const calculateMilestoneProgress = (m: Milestone) => {
    if (!m.userStoryIds || m.userStoryIds.length === 0) return 0;
    let totalProgress = 0;
    m.userStoryIds.forEach(sid => {
        totalProgress += calculateStoryProgress(tasks.filter(t => t.userStoryId === sid));
    });
    return Math.round(totalProgress / m.userStoryIds.length);
  };

  const onSubmit = async (data: any) => {
    try {
      await milestonesApi.save({ ...data, id: editingId || undefined }, selectedStoryIds);
      setIsDialogOpen(false);
      reset();
      setSelectedStoryIds([]);
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      alert("Failed to save milestone: " + (error.message || "Unknown error"));
    }
  };

  const onEdit = (m: Milestone, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(m.id);
    setValue('title', m.title);
    setValue('description', m.description);
    setValue('startDate', m.startDate);
    setValue('endDate', m.endDate);
    setValue('status', m.status);
    setSelectedStoryIds(m.userStoryIds || []);
    setIsDialogOpen(true);
  };

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('Delete milestone?')) {
        try {
          await milestonesApi.delete(id);
          fetchData();
        } catch (error: any) {
          console.error("Delete failed:", error);
          alert("Failed to delete milestone: " + (error.message || "Unknown error"));
        }
    }
  };

  const openDetails = (m: Milestone) => {
    setSelectedMilestone(m);
    setIsDetailOpen(true);
  };

  const toggleStorySelection = (sid: string) => {
      setSelectedStoryIds(prev => prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold tracking-tight">Milestones</h2><p className="text-sm text-muted-foreground">Track project goals.</p></div>
        {user?.isAdmin && <Button onClick={() => { setEditingId(null); setSelectedStoryIds([]); reset(); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Milestone</Button>}
      </div>
      
      {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {milestones.map(m => (
                <Card key={m.id} className="group hover:shadow-md transition-all cursor-pointer border-slate-200" onClick={() => openDetails(m)}>
                   <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                      <div className="space-y-1">
                        <Badge variant={m.status === 'Active' ? 'default' : m.status === 'Completed' ? 'outline' : 'secondary'} className={m.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>{m.status}</Badge>
                        <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{m.title}</CardTitle>
                      </div>
                      {user?.isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => onEdit(m, e)}><Edit2 className="h-3.5 w-3.5"/></Button>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => onDelete(m.id, e)}><Trash2 className="h-3.5 w-3.5"/></Button>
                        </div>
                      )}
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]" dir="auto">{m.description || "No description provided."}</p>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
                         <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {m.startDate}</div>
                         <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.endDate}</div>
                      </div>
                      <div className="space-y-1.5 pt-2">
                         <div className="flex justify-between items-center text-[10px]"><span className="font-bold text-slate-700">{calculateMilestoneProgress(m)}% Progress</span><span>{m.userStoryIds?.length || 0} Stories</span></div>
                         <ProgressBar progress={calculateMilestoneProgress(m)} />
                      </div>
                   </CardContent>
                </Card>
            ))}
          </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader><DialogTitle>{editingId ? "Edit" : "Create"} Milestone</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2"><Label>Title</Label><Input {...register('title', {required: true})} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea {...register('description')} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Start Date</Label><Input type="date" {...register('startDate')} /></div>
            <div className="space-y-2"><Label>End Date</Label><Input type="date" {...register('endDate')} /></div>
          </div>
          <div className="space-y-2"><Label>Link User Stories</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 bg-slate-50 space-y-1">
               {stories.map(s => (
                 <div key={s.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors" onClick={() => toggleStorySelection(s.id)}>
                    <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedStoryIds.includes(s.id) ? 'bg-primary border-primary' : 'bg-white border-slate-300'}`}>{selectedStoryIds.includes(s.id) && <CheckCircle className="h-3 w-3 text-white" />}</div>
                    <span className="text-[11px] font-bold truncate">{s.displayId ? `${s.displayId}: ` : ''}{s.title}</span>
                 </div>
               ))}
            </div>
          </div>
          <div className="space-y-2"><Label>Status</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('status')}><option value="Planned">Planned</option><option value="Active">Active</option><option value="Completed">Completed</option></select></div>
          <DialogFooter><Button type="submit">Save Milestone</Button></DialogFooter>
        </form>
      </Dialog>

      {selectedMilestone && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
           <DialogHeader className="border-b pb-4 mb-4">
              <Badge>{selectedMilestone.status}</Badge>
              <DialogTitle className="text-2xl font-black mt-2">{selectedMilestone.title}</DialogTitle>
           </DialogHeader>
           <div className="space-y-6">
              <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border italic" dir="auto">{selectedMilestone.description}</p>
              <div className="space-y-3">
                 <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Linked Stories</Label>
                 <div className="space-y-3 max-h-[350px] overflow-y-auto">
                    {selectedMilestone.userStoryIds?.map(sid => {
                       const story = stories.find(s => s.id === sid); if (!story) return null;
                       const sProgress = calculateStoryProgress(tasks.filter(t => t.userStoryId === story.id));
                       return (
                         <div key={sid} className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm">
                            <div className="flex justify-between items-start mb-2"><span className="text-sm font-bold truncate">{story.title}</span><Badge variant="secondary" className="text-[10px]">{sProgress}%</Badge></div>
                            <ProgressBar progress={sProgress} className="h-1.5" />
                         </div>
                       );
                    })}
                 </div>
              </div>
           </div>
           <DialogFooter><Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button></DialogFooter>
        </Dialog>
      )}
    </div>
  );
};

// --- Tasks View ---
export const TasksView = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [allStories, setAllStories] = useState<UserStory[]>([]);
  const { register: regCreate, handleSubmit: subCreate, reset: resetCreate, watch: watchCreate, setValue: setValueCreate } = useForm<Task>();

  const [filterTeam, setFilterTeam] = useState<string>('All');
  const [filterStack, setFilterStack] = useState<string>('All');
  const [filterAssignee, setFilterAssignee] = useState<string>('All');
  const [filterPanel, setFilterPanel] = useState<string>('All');
  const [filterStory, setFilterStory] = useState<string>('All');

  const STATUSES: Task['status'][] = ['To Do', 'In Progress', 'Testing', 'Review', 'Done'];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ts, tms, usrs, sts] = await Promise.all([
        tasksApi.getAll(),
        teamsApi.getAll(),
        usersApi.getAll(),
        storiesApi.getAll()
      ]);
      setTasks(ts);
      setTeams(tms);
      setUsersList(usrs);
      setAllStories(sts);
    } catch (e) {
      console.error("Error fetching tasks view data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDragStart = (e: React.DragEvent, taskId: string) => e.dataTransfer.setData('taskId', taskId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent, newStatus: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const taskToUpdate = tasks.find(t => t.id === taskId);
    
    if (taskToUpdate && taskToUpdate.status !== newStatus && user) {
        const oldStatus = taskToUpdate.status;
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        try {
            const updates: Partial<Task> = { 
                status: newStatus,
                history: [...(taskToUpdate.history || []), { status: newStatus, timestamp: Date.now(), userId: user.id, userName: user.name }]
            };
            if (newStatus === 'In Progress' && !taskToUpdate.startTime) updates.startTime = Date.now();
            if (newStatus === 'Done') updates.endTime = Date.now();
            await tasksApi.updateStatus(taskId, updates);
        } catch (error: any) {
            console.error("Drop status update failed:", error);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: oldStatus } : t));
            alert("Failed to update status: " + (error.message || "Unknown error"));
        }
    }
  };

  const onManualCreateSubmit = async (data: any) => {
    const parentStory = allStories.find(s => s.id === data.userStoryId);
    if (!parentStory) return;

    const now = Date.now();
    const newTaskData: Partial<Task> = {
        ...data, status: 'To Do', backlogId: parentStory.backlogId, panel: parentStory.panel || 'Admin',
        createdAt: now, history: [{ status: 'To Do', timestamp: now, userId: user?.id || 'system', userName: user?.name || 'System' }],
        createdBy: user ? { userId: user.id, userName: user.name } : { userId: 'system', userName: 'System' }
    };
    
    try {
        const newTask = await tasksApi.save(newTaskData);
        setTasks(prev => [...prev, newTask]);
        setIsCreateDialogOpen(false); resetCreate();
    } catch (e: any) {
        console.error("Task creation failed:", e);
        alert("Failed to create task: " + (e.message || "Unknown error"));
    }
  };

  const watchTeam = watchCreate('teamId');
  const availableMembers = watchTeam ? usersList.filter(u => teams.find(t => t.id === watchTeam)?.memberIds.includes(u.id)) : [];

  const filteredTasks = tasks.filter(task => {
      const matchTeam = filterTeam === 'All' || task.teamId === filterTeam;
      const matchStack = filterStack === 'All' || task.stack === filterStack;
      const matchAssignee = filterAssignee === 'All' || task.assigneeId === filterAssignee;
      const matchPanel = filterPanel === 'All' || task.panel === filterPanel;
      const matchStory = filterStory === 'All' || task.userStoryId === filterStory;
      return matchTeam && matchStack && matchAssignee && matchPanel && matchStory;
  });

  return (
    <div className="space-y-4 h-[calc(100vh-180px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-4"><h2 className="text-2xl font-bold tracking-tight">Project Board</h2><Button size="sm" onClick={() => { resetCreate(); setValueCreate('stack', 'Frontend'); setIsCreateDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Create Task</Button></div>
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1 shadow-sm overflow-x-auto max-w-full"><Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <select className="text-xs border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer" value={filterStory} onChange={(e) => setFilterStory(e.target.value)}><option value="All">All Stories</option>{allStories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
                <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>
                <select className="text-xs border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}><option value="All">All Teams</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>
                <select className="text-xs border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer" value={filterStack} onChange={(e) => setFilterStack(e.target.value)}><option value="All">All Stacks</option><option value="Frontend">Frontend</option><option value="Backend">Backend</option></select>
            </div>
        </div>
      </div>

      {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
          <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start pt-2">
            {STATUSES.map(status => (
                <div key={status} className="flex-shrink-0 w-80 bg-slate-100/50 rounded-xl flex flex-col max-h-full border border-slate-200" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                    <div className="p-3 border-b flex items-center justify-between bg-slate-50/50 rounded-t-xl"><span className="font-bold text-sm text-slate-700">{status}</span><Badge variant="secondary" className="text-[10px] bg-white">{filteredTasks.filter(t => t.status === status).length}</Badge></div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {filteredTasks.filter(t => t.status === status).map(task => (
                            <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id)} onClick={() => { setSelectedTask(task); setIsTaskDetailOpen(true); }} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-primary transition-all cursor-grab group">
                                <div className="flex items-start justify-between mb-2"><Badge variant="outline" className="text-[9px]">{task.panel}</Badge><GripVertical className="h-3 w-3 text-slate-300" /></div>
                                <h3 className="text-sm font-bold text-slate-800 leading-tight mb-2 line-clamp-2" dir="auto">{task.title}</h3>
                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                                    <div className="flex items-center gap-1.5 text-slate-600"><div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center"><UserIcon className="h-3 w-3 text-primary" /></div><span className="text-[10px] font-medium">{usersList.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
          </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogHeader><DialogTitle>Create New Task</DialogTitle></DialogHeader>
        <form onSubmit={subCreate(onManualCreateSubmit)} className="space-y-4 py-4">
            <div className="space-y-2"><Label>Parent Story</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regCreate('userStoryId', { required: true })}><option value="">-- Select Story --</option>{allStories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
            <div className="space-y-2"><Label>Title</Label><Input {...regCreate('title', { required: true })} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea {...regCreate('description')} /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Stack</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regCreate('stack')}><option value="Frontend">Frontend</option><option value="Backend">Backend</option></select></div>
            </div>
            <DialogFooter><Button type="submit">Create Task</Button></DialogFooter>
        </form>
      </Dialog>

      {selectedTask && (
          <TaskDetailModal 
            task={selectedTask} isOpen={isTaskDetailOpen} onClose={() => setIsTaskDetailOpen(false)} 
            onUpdate={(updated) => { setTasks(prev => prev.map(t => t.id === updated.id ? updated : t)); setSelectedTask(updated); }}
            onDelete={(id) => { setTasks(prev => prev.filter(t => t.id !== id)); setIsTaskDetailOpen(false); }}
            teams={teams} usersList={usersList} allStories={allStories}
          />
      )}
    </div>
  );
};
