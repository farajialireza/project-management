import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, writeBatch, query, where, collectionGroup } from 'firebase/firestore';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Badge, Card, CardHeader, CardTitle, CardContent, Textarea } from '../ui';
import { ProductBacklog, UserStory, Milestone, Task, Team, User, TaskComment } from '../../types';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, ListTodo, Sparkles, MessageSquare, History, User as UserIcon, Clock, Loader2, CheckCircle, Save, X, Filter } from 'lucide-react';
import { useAuth } from '../../App';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI, Type } from "@google/genai";

// --- Helper: Clean JSON Markdown ---
const cleanJson = (text: string) => {
  // Try to find JSON inside code blocks first
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return match[1];
  // If no code blocks, assume the whole text might be JSON, but trim it
  return text.trim();
};

// --- Backlogs View ---
export const BacklogsView = () => {
  const { user } = useAuth();
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue } = useForm<ProductBacklog>();

  // Filters
  const [filterPanel, setFilterPanel] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');

  const fetchBacklogs = async () => {
    const querySnapshot = await getDocs(collection(db, "product_backlogs"));
    const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProductBacklog));
    data.sort((a, b) => (a.displayId || "").localeCompare(b.displayId || "") || a.title.localeCompare(b.title));
    setBacklogs(data);
  };

  useEffect(() => { fetchBacklogs(); }, []);

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this backlog? All stories inside it will be lost.")) {
      try {
        const storiesRef = collection(db, "product_backlogs", id, "user_stories");
        const storiesSnap = await getDocs(storiesRef);
        const batch = writeBatch(db);
        storiesSnap.docs.forEach((storyDoc) => {
            batch.delete(storyDoc.ref);
        });
        const backlogRef = doc(db, "product_backlogs", id);
        batch.delete(backlogRef);
        await batch.commit();
        setBacklogs(prev => prev.filter(b => b.id !== id));
      } catch (error) {
        console.error("Error deleting backlog:", error);
        alert("Failed to delete backlog.");
      }
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
    if (editingId) {
      await updateDoc(doc(db, "product_backlogs", editingId), data);
    } else {
      await addDoc(collection(db, "product_backlogs"), { ...data, createdAt: Date.now() });
    }
    setIsDialogOpen(false);
    reset();
    setEditingId(null);
    fetchBacklogs();
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
            {filteredBacklogs.map(bl => (
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
                      <Button variant="ghost" size="icon" onClick={(e) => onEdit(bl, e)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => onDelete(bl.id, e)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredBacklogs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No backlogs found.</TableCell></TableRow>}
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

// --- Shared Task Detail Modal (Enhanced with Edit/Delete/Audit) ---
const TaskDetailModal = ({ task, isOpen, onClose, onUpdate, onDelete, teams, usersList }: { task: Task | null, isOpen: boolean, onClose: () => void, onUpdate: (t: Task) => void, onDelete: (id: string) => void, teams: Team[], usersList: User[] }) => {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Task>>({});
    
    // Check permissions
    const teamLeaderId = task?.teamId ? teams.find(t => t.id === task.teamId)?.leaderId : null;
    const canEdit = user?.isAdmin || (user && teamLeaderId === user.id);

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
        }
    }, [task, isOpen]);

    if (!task) return null;

    const updateStatus = async (newStatus: Task['status']) => {
        if (!user) return;
        const now = Date.now();
        const updates: any = { 
            status: newStatus,
            history: [...(task.history || []), { status: newStatus, timestamp: now, userId: user.id, userName: user.name }]
        };

        if (newStatus === 'In Progress' && !task.startTime) updates.startTime = now;
        if (newStatus === 'Done') updates.endTime = now;
        if (task.status === 'Done' && newStatus !== 'Done') updates.endTime = null;

        await updateDoc(doc(db, "tasks", task.id), updates);
        onUpdate({ ...task, ...updates });
    };

    const handleSaveEdit = async () => {
        if (!user) return;
        try {
            const updates = {
                ...editForm,
                lastEditedBy: {
                    userId: user.id,
                    userName: user.name,
                    timestamp: Date.now()
                }
            };
            await updateDoc(doc(db, "tasks", task.id), updates);
            onUpdate({ ...task, ...updates } as Task);
            setIsEditing(false);
        } catch (error) {
            console.error("Update failed", error);
            alert("Failed to update task");
        }
    };

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
            try {
                await deleteDoc(doc(db, "tasks", task.id));
                onDelete(task.id);
                onClose();
            } catch (error) {
                console.error("Delete failed", error);
                alert("Failed to delete task");
            }
        }
    };

    const addComment = async (text: string) => {
        if (!user || !text.trim()) return;
        const newComment: TaskComment = {
            id: Math.random().toString(36).substr(2, 9),
            userId: user.id,
            userName: user.name,
            text,
            timestamp: Date.now()
        };
        const updatedComments = [...(task.comments || []), newComment];
        await updateDoc(doc(db, "tasks", task.id), { comments: updatedComments });
        onUpdate({ ...task, comments: updatedComments });
    };

    // Filter available members if a team is selected in edit mode
    const watchTeamId = editForm.teamId;
    const availableMembers = watchTeamId
      ? usersList.filter(u => teams.find(t => t.id === watchTeamId)?.memberIds.includes(u.id))
      : usersList;

    return (
        <Dialog open={isOpen} onOpenChange={(v) => { if(!v) onClose(); }}>
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-4 border-b flex justify-between items-start bg-slate-50">
                        <div className="space-y-1 flex-1 mr-4">
                            <div className="flex gap-2 mb-2">
                                <Badge variant="outline">{task.panel}</Badge>
                                {!isEditing && <Badge variant="secondary">{task.stack}</Badge>}
                            </div>
                            
                            {isEditing ? (
                                <Input 
                                    value={editForm.title} 
                                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                                    className="font-bold text-lg"
                                />
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
                            <Label className="sr-only">Status</Label>
                            <select 
                                value={task.status} 
                                onChange={(e) => updateStatus(e.target.value as any)}
                                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-sm"
                            >
                                {['To Do', 'In Progress', 'Testing', 'Review', 'Done'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row">
                        <div className="flex-1 p-6 space-y-6 border-r">
                             {isEditing ? (
                                 <div className="space-y-2">
                                     <Label>Description (Markdown)</Label>
                                     <Textarea 
                                        value={editForm.description} 
                                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                                        className="min-h-[200px]"
                                     />
                                 </div>
                             ) : (
                                <div className="prose prose-sm max-w-none">
                                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Description</h3>
                                    <div className="markdown-body p-3 bg-slate-50 rounded-md border min-h-[100px]" dir="auto">
                                        <ReactMarkdown>{task.description || "*No description provided.*"}</ReactMarkdown>
                                    </div>
                                </div>
                             )}

                             <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4"/> Comments</h3>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                    {task.comments?.map(c => (
                                        <div key={c.id} className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
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
                                        addComment(el.value);
                                        el.value = '';
                                    }}>Send</Button>
                                </div>
                             </div>
                        </div>

                        {/* Sidebar */}
                        <div className="w-full md:w-72 bg-slate-50 p-4 space-y-6 text-sm overflow-y-auto">
                            <div className="space-y-3">
                                <span className="text-muted-foreground block text-xs uppercase font-bold">Assignments & Stack</span>
                                
                                {isEditing ? (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Stack</Label>
                                            <select 
                                                className="w-full h-8 rounded border text-xs px-2"
                                                value={editForm.stack}
                                                onChange={e => setEditForm({...editForm, stack: e.target.value as any})}
                                            >
                                                <option value="Frontend">Frontend</option>
                                                <option value="Backend">Backend</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Team</Label>
                                            <select 
                                                className="w-full h-8 rounded border text-xs px-2"
                                                value={editForm.teamId}
                                                onChange={e => setEditForm({...editForm, teamId: e.target.value, assigneeId: ''})}
                                            >
                                                <option value="">-- None --</option>
                                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Assignee</Label>
                                            <select 
                                                className="w-full h-8 rounded border text-xs px-2"
                                                value={editForm.assigneeId}
                                                onChange={e => setEditForm({...editForm, assigneeId: e.target.value})}
                                            >
                                                <option value="">-- Unassigned --</option>
                                                {availableMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-white p-2 rounded border shadow-sm">
                                            <div className="text-xs text-muted-foreground">Team</div>
                                            <div className="font-medium">{teams.find(t => t.id === task.teamId)?.name || 'None'}</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border shadow-sm">
                                            <div className="text-xs text-muted-foreground">Assignee</div>
                                            <div className="font-medium">{usersList.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}</div>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <span className="text-muted-foreground block text-xs uppercase font-bold">Audit</span>
                                <div className="text-xs text-slate-600 bg-white p-2 rounded border">
                                    {task.createdBy ? (
                                        <div className="mb-1"><strong>Created by:</strong> {task.createdBy.userName}</div>
                                    ) : <div className="mb-1 text-muted-foreground italic">Creator not recorded</div>}
                                    
                                    {task.lastEditedBy ? (
                                        <div>
                                            <strong>Edited by:</strong> {task.lastEditedBy.userName}
                                            <br/><span className="text-[10px] text-muted-foreground">{new Date(task.lastEditedBy.timestamp).toLocaleString()}</span>
                                        </div>
                                    ) : <div className="text-muted-foreground italic">No edits recorded</div>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-muted-foreground block text-xs uppercase font-bold">History</span>
                                <div className="space-y-2 relative border-l ml-2 pl-4">
                                    {task.history?.slice().reverse().map((h, i) => (
                                        <div key={i} className="relative text-xs">
                                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white"></div>
                                            <div className="font-medium text-slate-700">{h.status}</div>
                                            <div className="text-muted-foreground">{h.userName}</div>
                                            <div className="text-[10px] text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</div>
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

// --- Stories View (Hierarchical) ---
export const StoriesView = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<(UserStory & { backlogTitle?: string })[]>([]);
  const [tasksCache, setTasksCache] = useState<Record<string, Task[]>>({}); // Cache tasks per story
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

  // Filters
  const [filterBacklog, setFilterBacklog] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');

  const fetchData = async () => {
    try {
        const [blSnap, teamSnap, userSnap] = await Promise.all([
            getDocs(collection(db, "product_backlogs")),
            getDocs(collection(db, "teams")),
            getDocs(collection(db, "users"))
        ]);

        const bls = blSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductBacklog));
        setBacklogs(bls);
        setTeams(teamSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
        setUsersList(userSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        
        // Use Promise.all to fetch stories in parallel for each backlog (instead of collectionGroup which causes permission issues)
        const storyPromises = bls.map(async (bl) => {
            const snap = await getDocs(collection(db, `product_backlogs/${bl.id}/user_stories`));
            return snap.docs.map(d => ({
                id: d.id,
                backlogTitle: bl.title,
                backlogId: bl.id,
                ...d.data()
            } as UserStory & { backlogTitle: string }));
        });

        const storiesArrays = await Promise.all(storyPromises);
        const allStories = storiesArrays.flat();

        allStories.sort((a, b) => (a.displayId || "").localeCompare(b.displayId || "") || a.title.localeCompare(b.title));
        setStories(allStories);
    } catch (e) {
        console.error("Error fetching data", e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Lazy load tasks for a story
  const toggleStory = async (storyId: string) => {
    if (expandedStoryId === storyId) {
        setExpandedStoryId(null);
        return;
    }
    setExpandedStoryId(storyId);

    // If not in cache, fetch
    if (!tasksCache[storyId]) {
        setLoadingTasks(prev => ({ ...prev, [storyId]: true }));
        try {
            const q = query(collection(db, "tasks"), where("userStoryId", "==", storyId));
            const snap = await getDocs(q);
            const loadedTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
            setTasksCache(prev => ({ ...prev, [storyId]: loadedTasks }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingTasks(prev => ({ ...prev, [storyId]: false }));
        }
    }
  };

  const onSaveStory = async (data: any) => {
    const { backlogId, ...rest } = data;
    if (editingStoryId) {
        const originalStory = stories.find(s => s.id === editingStoryId);
        if (originalStory) {
             await updateDoc(doc(db, `product_backlogs/${originalStory.backlogId}/user_stories`, editingStoryId), { ...rest });
        }
    } else {
        const parentBacklog = backlogs.find(b => b.id === backlogId);
        const inheritedPanel = parentBacklog?.panel || 'Admin';
        await addDoc(collection(db, `product_backlogs/${backlogId}/user_stories`), {
            ...rest,
            backlogId,
            panel: inheritedPanel
        });
    }
    setIsStoryDialogOpen(false);
    resetStory();
    setEditingStoryId(null);
    fetchData();
  };

  const onDeleteStory = async (story: UserStory, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm(`Delete "${story.title}"?`)) {
        try {
            await deleteDoc(doc(db, `product_backlogs/${story.backlogId}/user_stories`, story.id));
            fetchData();
        } catch (err) { alert("Failed to delete story."); }
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
    const newTaskData = {
        title: data.title,
        description: data.description,
        status: 'To Do',
        userStoryId: targetStory.id,
        backlogId: targetStory.backlogId,
        panel: targetStory.panel || 'Admin',
        stack: data.stack,
        teamId: data.teamId || null,
        assigneeId: data.assigneeId || null,
        createdAt: Date.now(),
        history: [{
            status: 'To Do',
            timestamp: Date.now(),
            userId: user?.id || 'system',
            userName: user?.name || 'System'
        }],
        comments: [],
        createdBy: user ? { userId: user.id, userName: user.name } : { userId: 'system', userName: 'System' }
    };
    
    // @ts-ignore
    const docRef = await addDoc(collection(db, "tasks"), newTaskData);
    
    // Update cache
    const newTask = { id: docRef.id, ...newTaskData } as Task;
    setTasksCache(prev => ({
        ...prev,
        [targetStory.id]: [...(prev[targetStory.id] || []), newTask]
    }));

    setIsAddTaskDialogOpen(false);
    setExpandedStoryId(targetStory.id);
  };

  const generateAiTasks = async () => {
    if (!targetStory) return;
    setAiLoading(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate technical tasks for this User Story in **Persian (Farsi)**.
            Story Title: ${targetStory.title}
            Story Description: ${targetStory.description}
            
            Return a list of tasks. Each task must have a title and description in Persian, and a technical stack ('Frontend' or 'Backend').`,
            config: {
                systemInstruction: "You are an expert Agile Developer assistant. You speak Farsi. Generate output in JSON.",
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
                                    stack: { type: Type.STRING, enum: ['Frontend', 'Backend'] }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        const generated = JSON.parse(cleanJson(response.text || "{}"));
        if (generated.tasks) {
            const batch = writeBatch(db);
            const newTasks: Task[] = [];
            
            generated.tasks.forEach((t: any) => {
                const docRef = doc(collection(db, "tasks"));
                const newTask: Task = {
                    id: docRef.id,
                    title: t.title,
                    description: t.description,
                    status: 'To Do',
                    userStoryId: targetStory.id,
                    backlogId: targetStory.backlogId,
                    panel: targetStory.panel || 'Admin',
                    stack: t.stack,
                    createdAt: Date.now(),
                    history: [{
                        status: 'To Do',
                        timestamp: Date.now(),
                        userId: user?.id || 'ai',
                        userName: user?.name || 'AI Assistant'
                    }],
                    comments: [],
                    createdBy: { userId: user?.id || 'ai', userName: user?.name || 'AI Assistant' }
                };
                
                const { id, ...firestoreData } = newTask;
                batch.set(docRef, firestoreData);
                newTasks.push(newTask);
            });
            await batch.commit();
            
            // Update cache locally
            setTasksCache(prev => ({
                ...prev,
                [targetStory.id]: [...(prev[targetStory.id] || []), ...newTasks]
            }));

            setExpandedStoryId(targetStory.id);
            setIsAddTaskDialogOpen(false);
        }
    } catch (e) {
        console.error(e);
        alert("AI Generation failed. Check console.");
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
    return matchBacklog && matchPriority;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">User Stories</h2>
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1 shadow-sm">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select 
                    className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer max-w-[150px] truncate"
                    value={filterBacklog}
                    onChange={(e) => setFilterBacklog(e.target.value)}
                >
                    <option value="All">All Backlogs</option>
                    {backlogs.map(b => (
                        <option key={b.id} value={b.id}>
                            {b.displayId ? `${b.displayId} - ` : ''}{b.title}
                        </option>
                    ))}
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
              <TableHead>Priority</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStories.map(story => {
              const isExpanded = expandedStoryId === story.id;
              const isLoading = loadingTasks[story.id];
              const storyTasks = tasksCache[story.id] || [];
              
              return (
                <React.Fragment key={story.id}>
                  <TableRow className={isExpanded ? "bg-muted/50 border-b-0" : "cursor-pointer"} onClick={() => toggleStory(story.id)}>
                    <TableCell>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{story.displayId || '-'}</TableCell>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                           {story.title}
                           {story.panel && <Badge variant="outline" className="text-[10px] h-5">{story.panel}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">{story.description}</div>
                    </TableCell>
                    <TableCell>{story.backlogTitle}</TableCell>
                    <TableCell>
                      <Badge variant={story.priority === 'High' ? 'destructive' : story.priority === 'Medium' ? 'default' : 'secondary'}>
                        {story.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={(e) => openAddTask(story, e)}>
                                <ListTodo className="h-3 w-3 mr-2" /> Add Task
                            </Button>
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
                             {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                             {!isLoading && ` (${storyTasks.length})`}
                           </h4>
                           {isLoading ? (
                               <div className="py-4 text-center text-sm text-muted-foreground">Loading tasks...</div>
                           ) : storyTasks.length === 0 ? (
                             <p className="text-xs text-muted-foreground italic">No tasks yet.</p>
                           ) : (
                             <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                               {storyTasks.map(task => (
                                 <div key={task.id} onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setIsTaskDetailOpen(true); }} className="cursor-pointer group relative flex flex-col gap-2 bg-background p-3 rounded-lg border hover:border-primary transition-colors shadow-sm">
                                   <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                         <Badge variant="secondary" className="text-[10px]">{task.stack}</Badge>
                                         <Badge variant="outline" className="text-[10px]">{task.panel}</Badge>
                                      </div>
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
            {filteredStories.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No stories found.</TableCell></TableRow>}
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
          <div className="space-y-2"><Label>Description</Label><Input {...regStory('description')} /></div>
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
            <div className="relative mb-4"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or Manual Entry</span></div></div>
            
            <form onSubmit={subTask(onAddTaskSubmit)} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input {...regTask('title', { required: true })} /></div>
                <div className="space-y-2"><Label>Description (Markdown)</Label><Textarea {...regTask('description')} placeholder="Supports Markdown..." /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Stack</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regTask('stack')}>
                            <option value="Frontend">Frontend</option>
                            <option value="Backend">Backend</option>
                        </select>
                    </div>
                    <div className="space-y-2"><Label>Inherited Panel</Label><Input disabled value={targetStory?.panel || 'Admin'} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Assign Team</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regTask('teamId')}>
                            <option value="">-- No Team --</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Assign Member</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regTask('assigneeId')}>
                             <option value="">-- Unassigned --</option>
                             {availableMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                </div>
                <DialogFooter><Button type="submit">Create Task</Button></DialogFooter>
            </form>
        </div>
      </Dialog>
      
      <TaskDetailModal 
        task={selectedTask} 
        isOpen={isTaskDetailOpen} 
        onClose={() => setIsTaskDetailOpen(false)} 
        onUpdate={(updated) => {
            setSelectedTask(updated);
            // Update cache locally instead of full list
            setTasksCache(prev => {
                const storyId = updated.userStoryId;
                const tasks = prev[storyId] || [];
                return {
                    ...prev,
                    [storyId]: tasks.map(t => t.id === updated.id ? updated : t)
                };
            });
        }}
        onDelete={(id) => {
             // Update cache locally
             setTasksCache(prev => {
                 if (!selectedTask) return prev;
                 const storyId = selectedTask.userStoryId;
                 return {
                     ...prev,
                     [storyId]: (prev[storyId] || []).filter(t => t.id !== id)
                 };
             });
             setIsTaskDetailOpen(false);
        }}
        teams={teams}
        usersList={usersList}
      />
    </div>
  );
};

// --- Milestones View ---
export const MilestonesView = () => {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue } = useForm<Milestone>();

  const fetchMilestones = async () => {
    const q = query(collection(db, "milestones"));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Milestone));
    setMilestones(data.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()));
  };

  useEffect(() => { fetchMilestones(); }, []);

  const onDelete = async (id: string) => {
    if (confirm("Delete this milestone?")) {
      await deleteDoc(doc(db, "milestones", id));
      fetchMilestones();
    }
  };

  const onEdit = (m: Milestone) => {
    setEditingId(m.id);
    setValue('title', m.title);
    setValue('description', m.description);
    setValue('startDate', m.startDate);
    setValue('endDate', m.endDate);
    setValue('status', m.status);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    if (editingId) {
      await updateDoc(doc(db, "milestones", editingId), data);
    } else {
      await addDoc(collection(db, "milestones"), { ...data });
    }
    setIsDialogOpen(false);
    reset();
    setEditingId(null);
    fetchMilestones();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Milestones</h2>
        {user?.isAdmin && <Button onClick={() => { setEditingId(null); reset(); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Milestone</Button>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {milestones.map(m => (
            <Card key={m.id} className="relative">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{m.title}</CardTitle>
                        <Badge variant={m.status === 'Completed' ? 'default' : m.status === 'Active' ? 'secondary' : 'outline'}>{m.status}</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{m.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground gap-4">
                        <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Start: {m.startDate}</div>
                        <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> End: {m.endDate}</div>
                    </div>
                     {user?.isAdmin && (
                        <div className="absolute top-4 right-4 flex gap-1 bg-white/50 backdrop-blur-sm rounded">
                           <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(m)}><Edit2 className="h-3 w-3" /></Button>
                           <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(m.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                     )}
                </CardContent>
            </Card>
        ))}
      </div>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader><DialogTitle>{editingId ? "Edit" : "Create"} Milestone</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2"><Label>Title</Label><Input {...register('title', { required: true })} /></div>
          <div className="space-y-2"><Label>Description</Label><Input {...register('description')} /></div>
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" {...register('startDate')} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" {...register('endDate')} /></div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('status')}>
                <option value="Planned">Planned</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
            </select>
          </div>
          <DialogFooter><Button type="submit">{editingId ? "Update" : "Create"}</Button></DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};

// --- Tasks View (Kanban) ---
export const TasksView = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [filterSelf, setFilterSelf] = useState(false);

    const fetchData = async () => {
        const [tSnap, tmSnap, uSnap] = await Promise.all([
            getDocs(collection(db, "tasks")),
            getDocs(collection(db, "teams")),
            getDocs(collection(db, "users"))
        ]);
        setTasks(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
        setTeams(tmSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
        setUsersList(uSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    };

    useEffect(() => { fetchData(); }, []);

    const COLUMNS: Task['status'][] = ['To Do', 'In Progress', 'Testing', 'Review', 'Done'];

    const filteredTasks = filterSelf && user ? tasks.filter(t => t.assigneeId === user.id) : tasks;

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col space-y-4">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Task Board</h2>
                <div className="flex items-center gap-2">
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="my-tasks" className="cursor-pointer">My Tasks Only</Label>
                        <input id="my-tasks" type="checkbox" checked={filterSelf} onChange={e => setFilterSelf(e.target.checked)} className="h-4 w-4" />
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData}><History className="mr-2 h-4 w-4" /> Refresh</Button>
                </div>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-4 min-w-[1000px] pb-4">
                    {COLUMNS.map(status => (
                        <div key={status} className="flex-1 min-w-[280px] bg-muted/30 rounded-lg flex flex-col max-h-full">
                             <div className="p-3 font-semibold text-sm text-muted-foreground flex justify-between items-center bg-muted/50 rounded-t-lg">
                                {status}
                                <span className="bg-background px-2 py-0.5 rounded-full text-xs border">{filteredTasks.filter(t => t.status === status).length}</span>
                             </div>
                             <div className="p-2 space-y-2 overflow-y-auto flex-1">
                                {filteredTasks.filter(t => t.status === status).map(task => (
                                    <div 
                                        key={task.id} 
                                        onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}
                                        className="bg-background p-3 rounded border shadow-sm cursor-pointer hover:border-primary transition-all space-y-2 group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-mono text-muted-foreground truncate">{task.stack}</span>
                                            {task.panel && (
                                               <Badge variant="outline" className="text-[10px] h-4 px-1">{task.panel}</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium line-clamp-2" dir="auto">{task.title}</p>
                                        <div className="flex justify-between items-center pt-1">
                                             <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <UserIcon className="h-3 w-3" />
                                                <span className="max-w-[80px] truncate">{usersList.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}</span>
                                             </div>
                                             {task.comments && task.comments.length > 0 && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    ))}
                </div>
            </div>

            <TaskDetailModal 
                task={selectedTask} 
                isOpen={isDetailOpen} 
                onClose={() => setIsDetailOpen(false)} 
                onUpdate={(updated) => {
                    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
                    setSelectedTask(updated);
                }}
                onDelete={(id) => {
                    setTasks(prev => prev.filter(t => t.id !== id));
                    setIsDetailOpen(false);
                }}
                teams={teams}
                usersList={usersList}
            />
        </div>
    );
};
