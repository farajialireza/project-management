import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, writeBatch, query, where, collectionGroup } from 'firebase/firestore';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Badge, Card, CardHeader, CardTitle, CardContent, Textarea } from '../ui';
import { ProductBacklog, UserStory, Milestone, Task, Team, User, TaskComment } from '../../types';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, ListTodo, Sparkles, MessageSquare, History, User as UserIcon, Users as UsersIcon, Clock, Loader2, CheckCircle, Save, X, Filter, Search, Calendar, Layout, BarChart3, FileText, Info } from 'lucide-react';
import { useAuth } from '../../App';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI, Type } from "@google/genai";

// --- Helpers ---
const cleanJson = (text: string) => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return match[1];
  return text.trim();
};

const ProgressBar = ({ progress, className = "" }: { progress: number, className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 overflow-hidden ${className}`}>
    <div 
      className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-primary' : 'bg-transparent'}`} 
      style={{ width: `${progress}%` }}
    />
  </div>
);

// --- Backlogs View ---
export const BacklogsView = () => {
  const { user } = useAuth();
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue } = useForm<ProductBacklog>();

  const [filterPanel, setFilterPanel] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');

  const fetchBacklogs = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "product_backlogs"));
      const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProductBacklog));
      data.sort((a, b) => (a.displayId || "").localeCompare(b.displayId || "") || a.title.localeCompare(b.title));
      setBacklogs(data);
    } catch (error) {
      console.error("Error fetching backlogs:", error);
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
      const batch = writeBatch(db);
      const tasksQuery = query(collection(db, "tasks"), where("backlogId", "==", id));
      const tasksSnap = await getDocs(tasksQuery);
      tasksSnap.docs.forEach(taskDoc => {
        batch.delete(taskDoc.ref);
      });

      const storiesRef = collection(db, "product_backlogs", id, "user_stories");
      const storiesSnap = await getDocs(storiesRef);
      storiesSnap.docs.forEach(storyDoc => {
        batch.delete(storyDoc.ref);
      });

      const backlogRef = doc(db, "product_backlogs", id);
      batch.delete(backlogRef);

      await batch.commit();
      setBacklogs(prev => prev.filter(b => b.id !== id));
      alert("بکلگ و تمامی داده‌های مرتبط با موفقیت حذف شدند.");
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
      if (editingId) {
        await updateDoc(doc(db, "product_backlogs", editingId), data);
      } else {
        await addDoc(collection(db, "product_backlogs"), { ...data, createdAt: Date.now() });
      }
      setIsDialogOpen(false);
      reset();
      setEditingId(null);
      fetchBacklogs();
    } catch (error) {
      console.error("Error saving backlog:", error);
      alert("خطا در ذخیره‌سازی.");
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
            {filteredBacklogs.length === 0 && (
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
        if (confirm("Are you sure you want to delete this task?")) {
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
                    
                    <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row">
                        <div className="flex-1 p-6 space-y-8 border-r">
                             {/* TASK DESCRIPTION SECTION (MOVING TO TOP) */}
                             <div className="space-y-6">
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <FileText className="h-4 w-4" /> Task Description (Markdown)
                                        </Label>
                                        <Textarea 
                                            value={editForm.description} 
                                            onChange={e => setEditForm({...editForm, description: e.target.value})}
                                            className="min-h-[250px]"
                                        />
                                    </div>
                                ) : (
                                    <div className="prose prose-sm max-w-none">
                                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                                            <FileText className="h-4 w-4" /> Task Description
                                        </h3>
                                        <div className="markdown-body p-4 bg-slate-50 rounded-lg border min-h-[120px]" dir="auto">
                                            <ReactMarkdown>{task.description || "*No task description provided.*"}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                             </div>

                             {/* STORY CONTEXT BOX (MOVING BELOW DESCRIPTION) */}
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
                                        addComment(el.value);
                                        el.value = '';
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
                                        <div className="bg-white p-3 rounded-lg border shadow-sm">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Team</div>
                                            <div className="font-medium flex items-center gap-2">
                                                <UsersIcon className="h-3.5 w-3.5 text-primary" />
                                                {teams.find(t => t.id === task.teamId)?.name || 'None'}
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border shadow-sm">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Assignee</div>
                                            <div className="font-medium flex items-center gap-2">
                                                <UserIcon className="h-3.5 w-3.5 text-primary" />
                                                {usersList.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight">Audit</span>
                                <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border shadow-sm space-y-2">
                                    {task.createdBy ? (
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Created by</div>
                                            <div className="font-medium">{task.createdBy.userName}</div>
                                            <div className="text-[10px] text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</div>
                                        </div>
                                    ) : <div className="text-muted-foreground italic">Creator not recorded</div>}
                                    
                                    {task.lastEditedBy ? (
                                        <div className="pt-2 border-t">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Last edited by</div>
                                            <div className="font-medium">{task.lastEditedBy.userName}</div>
                                            <div className="text-[10px] text-muted-foreground">{new Date(task.lastEditedBy.timestamp).toLocaleString()}</div>
                                        </div>
                                    ) : <div className="text-muted-foreground italic pt-2 border-t">No edits recorded</div>}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight">Lifecycle History</span>
                                <div className="space-y-4 relative border-l-2 ml-2 pl-4 py-1 border-slate-200">
                                    {task.history?.slice().reverse().map((h, i) => (
                                        <div key={i} className="relative text-xs">
                                            <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-white border-2 border-primary"></div>
                                            <div className="font-bold text-slate-900">{h.status}</div>
                                            <div className="text-muted-foreground font-medium flex items-center gap-1">
                                                <UserIcon className="h-2.5 w-2.5" /> {h.userName}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-2.5 w-2.5" /> {new Date(h.timestamp).toLocaleString()}
                                            </div>
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

  const toggleStory = async (storyId: string) => {
    if (expandedStoryId === storyId) {
        setExpandedStoryId(null);
        return;
    }
    setExpandedStoryId(storyId);

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
    if(confirm(`آیا مطمئن هستید که می‌خواهید استوری "${story.title}" را به همراه تمام تسک‌های آن حذف کنید؟`)) {
        try {
            const batch = writeBatch(db);
            const tasksQuery = query(collection(db, "tasks"), where("userStoryId", "==", story.id));
            const tasksSnap = await getDocs(tasksQuery);
            tasksSnap.docs.forEach(taskDoc => {
              batch.delete(taskDoc.ref);
            });

            const storyRef = doc(db, `product_backlogs/${story.backlogId}/user_stories`, story.id);
            batch.delete(storyRef);

            await batch.commit();
            fetchData();
        } catch (err) { 
          console.error(err);
          alert("خطا در حذف استوری."); 
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
            // Updated to gemini-3-flash-preview per guidelines for basic/general text tasks.
            model: 'gemini-3-flash-preview',
            contents: `Generate technical tasks for this User Story in **Persian (Farsi)**.
            The project uses **Next.js** for Frontend and **Python Django** for Backend.
            Keep the tasks practical but not overly technical.
            
            Story Title: ${targetStory.title}
            Story Description: ${targetStory.description}
            
            Return a list of tasks. Each task must have a title and description in Persian, and a technical stack ('Frontend' or 'Backend').`,
            config: {
                systemInstruction: "You are an expert Agile Developer assistant specializing in Next.js (Frontend) and Python Django (Backend). You speak Farsi. Generate output in JSON.",
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
              <TableHead>Progress</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStories.map(story => {
              const isExpanded = expandedStoryId === story.id;
              const isLoading = loadingTasks[story.id];
              const storyTasks = tasksCache[story.id] || [];
              const progress = calculateStoryProgress(storyTasks);
              
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
                    <TableCell className="w-[150px]">
                      {tasksCache[story.id] ? (
                        <div className="space-y-1">
                          <ProgressBar progress={progress} />
                          <div className="text-[10px] text-muted-foreground text-center font-medium">{progress}% ({storyTasks.filter(t => t.status === 'Done').length}/{storyTasks.length} tasks)</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 opacity-50">
                           <Badge variant="outline" className="text-[10px]">{story.points} pts</Badge>
                           <div className="h-1 w-12 bg-gray-100 rounded"></div>
                        </div>
                      )}
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
        allStories={stories}
      />
    </div>
  );
};

// --- Milestone Detail Modal ---
const MilestoneDetailModal = ({ milestone, isOpen, onClose, allStories, teams, usersList, storyProgressMap }: {
  milestone: Milestone | null;
  isOpen: boolean;
  onClose: () => void;
  allStories: (UserStory & { backlogTitle?: string })[];
  teams: Team[];
  usersList: User[];
  storyProgressMap: Record<string, number>;
}) => {
  const [tasksCache, setTasksCache] = useState<Record<string, Task[]>>({});
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({});
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setExpandedStoryId(null);
      setTasksCache({});
    }
  }, [isOpen]);

  if (!milestone) return null;

  const linkedStories = allStories.filter(s => milestone.userStoryIds?.includes(s.id));
  const totalPoints = linkedStories.reduce((acc, s) => acc + (s.points || 1), 0);
  const milestoneProgress = totalPoints > 0 
    ? Math.round(linkedStories.reduce((acc, s) => acc + (storyProgressMap[s.id] || 0) * (s.points || 1), 0) / totalPoints)
    : 0;

  const toggleStory = async (storyId: string) => {
    if (expandedStoryId === storyId) {
      setExpandedStoryId(null);
      return;
    }
    setExpandedStoryId(storyId);

    if (!tasksCache[storyId]) {
      setLoadingTasks(prev => ({ ...prev, [storyId]: true }));
      try {
        const q = query(collection(db, "tasks"), where("userStoryId", "==", storyId));
        const snap = await getDocs(q);
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        setTasksCache(prev => ({ ...prev, [storyId]: tasks }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingTasks(prev => ({ ...prev, [storyId]: false }));
      }
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
             <div className="p-6 border-b flex justify-between items-start bg-slate-50">
                <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant={milestone.status === 'Completed' ? 'default' : milestone.status === 'Active' ? 'secondary' : 'outline'}>{milestone.status}</Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                             <Calendar className="h-3 w-3" /> {milestone.startDate} - {milestone.endDate}
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold">{milestone.title}</h2>
                    <p className="text-muted-foreground">{milestone.description}</p>
                    
                    <div className="pt-4 max-w-md">
                        <div className="flex justify-between items-center text-xs mb-1 font-semibold text-primary">
                            <span>OVERALL PROGRESS</span>
                            <span>{milestoneProgress}%</span>
                        </div>
                        <ProgressBar progress={milestoneProgress} className="h-3" />
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
             </div>

             <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" /> Linked User Stories ({linkedStories.length})
                </h3>
                
                {linkedStories.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground italic border-2 border-dashed rounded-lg">
                        No stories linked to this milestone.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {linkedStories.map(story => {
                             const isExpanded = expandedStoryId === story.id;
                             const tasks = tasksCache[story.id] || [];
                             const isLoading = loadingTasks[story.id];
                             const storyProgress = storyProgressMap[story.id] || 0;

                             return (
                                 <div key={story.id} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                     <div 
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => toggleStory(story.id)}
                                     >
                                         <div className="flex items-center gap-3 flex-1">
                                             {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                             <div className="flex-1 mr-4">
                                                 <div className="flex items-center gap-2">
                                                     <span className="font-medium">{story.displayId ? `[${story.displayId}] ` : ''}{story.title}</span>
                                                     <Badge variant="outline" className="text-[10px]">{story.panel}</Badge>
                                                 </div>
                                                 <div className="text-xs text-muted-foreground">{story.backlogTitle}</div>
                                             </div>
                                             <div className="w-32 hidden sm:block">
                                                 <div className="flex justify-between items-center text-[10px] mb-1">
                                                     <span>{storyProgress}%</span>
                                                     <span className="opacity-50">{story.points} pts</span>
                                                 </div>
                                                 <ProgressBar progress={storyProgress} className="h-1.5" />
                                             </div>
                                         </div>
                                         <Badge variant={story.priority === 'High' ? 'destructive' : 'secondary'} className="ml-4">{story.priority}</Badge>
                                     </div>
                                     
                                     {isExpanded && (
                                         <div className="border-t bg-slate-50 p-4 pl-12">
                                             {isLoading ? (
                                                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                     <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks...
                                                 </div>
                                             ) : tasks.length === 0 ? (
                                                 <p className="text-sm text-muted-foreground italic">No tasks found for this story.</p>
                                             ) : (
                                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                     {tasks.map(task => (
                                                         <div 
                                                            key={task.id} 
                                                            className="bg-white p-3 rounded border hover:border-primary cursor-pointer shadow-sm transition-all"
                                                            onClick={() => { setSelectedTask(task); setIsTaskDetailOpen(true); }}
                                                         >
                                                             <div className="flex justify-between items-start mb-2">
                                                                 <Badge variant="secondary" className="text-[10px]">{task.stack}</Badge>
                                                                 <Badge variant="outline" className={`text-[10px] ${task.status === 'Done' ? 'bg-green-50 text-green-700' : ''}`}>{task.status}</Badge>
                                                             </div>
                                                             <p className="text-sm font-medium line-clamp-2 mb-2" dir="auto">{task.title}</p>
                                                             <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                                 <div className="flex items-center gap-1">
                                                                     <UserIcon className="h-3 w-3" />
                                                                     {usersList.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}
                                                                 </div>
                                                             </div>
                                                         </div>
                                                     ))}
                                                 </div>
                                             )}
                                         </div>
                                     )}
                                 </div>
                             )
                        })}
                    </div>
                )}
             </div>
          </div>
        </div>
      </Dialog>

      <TaskDetailModal 
        task={selectedTask} 
        isOpen={isTaskDetailOpen} 
        onClose={() => setIsTaskDetailOpen(false)} 
        onUpdate={(updated) => {
            setSelectedTask(updated);
            setTasksCache(prev => {
                const storyId = updated.userStoryId;
                const list = prev[storyId] || [];
                return {
                    ...prev,
                    [storyId]: list.map(t => t.id === updated.id ? updated : t)
                };
            });
        }}
        onDelete={(id) => {
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
        allStories={allStories}
      />
    </>
  );
};

// --- Milestones View ---
export const MilestonesView = () => {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [allStories, setAllStories] = useState<(UserStory & { backlogTitle: string })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [storyProgressMap, setStoryProgressMap] = useState<Record<string, number>>({});
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMilestone, setViewMilestone] = useState<Milestone | null>(null);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [storySearch, setStorySearch] = useState("");
  const { register, handleSubmit, reset, setValue } = useForm<Milestone>();

  const fetchData = async () => {
    setLoadingProgress(true);
    try {
        const q = query(collection(db, "milestones"));
        const querySnapshot = await getDocs(q);
        const mData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Milestone));
        setMilestones(mData.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()));

        const [tSnap, uSnap] = await Promise.all([
            getDocs(collection(db, "teams")),
            getDocs(collection(db, "users"))
        ]);
        setTeams(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
        setUsersList(uSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));

        const bSnap = await getDocs(collection(db, "product_backlogs"));
        const bls = bSnap.docs.map(d => ({ id: d.id, title: d.data().title }));
        
        const storiesPromises = bls.map(async (bl) => {
            const sSnap = await getDocs(collection(db, `product_backlogs/${bl.id}/user_stories`));
            return sSnap.docs.map(d => ({ 
                id: d.id, 
                ...d.data(), 
                backlogTitle: bl.title 
            } as UserStory & { backlogTitle: string }));
        });
        const storiesFlat = (await Promise.all(storiesPromises)).flat();
        setAllStories(storiesFlat);

        const tasksSnap = await getDocs(collection(db, "tasks"));
        const allTasks = tasksSnap.docs.map(d => d.data() as Task);
        const progressMap: Record<string, number> = {};
        storiesFlat.forEach(story => {
            const storyTasks = allTasks.filter(t => t.userStoryId === story.id);
            progressMap[story.id] = calculateStoryProgress(storyTasks);
        });
        setStoryProgressMap(progressMap);
    } catch (e) {
        console.error("Error fetching data", e);
    } finally {
        setLoadingProgress(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("آیا مایل‌ستون را حذف می‌کنید؟")) {
      await deleteDoc(doc(db, "milestones", id));
      fetchData();
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
    setStorySearch("");
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    const payload = { ...data, userStoryIds: selectedStoryIds };
    try {
      if (editingId) {
        await updateDoc(doc(db, "milestones", editingId), payload);
      } else {
        await addDoc(collection(db, "milestones"), payload);
      }
      setIsDialogOpen(false);
      reset();
      setEditingId(null);
      setSelectedStoryIds([]);
      setStorySearch("");
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleStory = (sid: string) => {
      if (selectedStoryIds.includes(sid)) {
          setSelectedStoryIds(selectedStoryIds.filter(id => id !== sid));
      } else {
          setSelectedStoryIds([...selectedStoryIds, sid]);
      }
  };

  const filteredStoriesForSearch = allStories.filter(s => 
      s.title.toLowerCase().includes(storySearch.toLowerCase()) || 
      (s.displayId && s.displayId.toLowerCase().includes(storySearch.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Milestones</h2>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loadingProgress}>
                {loadingProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                Recalculate Progress
            </Button>
            {user?.isAdmin && <Button onClick={() => { setEditingId(null); setSelectedStoryIds([]); setStorySearch(""); reset(); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Milestone</Button>}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {milestones.map(m => {
            const linkedStories = allStories.filter(s => m.userStoryIds?.includes(s.id));
            const totalPoints = linkedStories.reduce((acc, s) => acc + (s.points || 1), 0);
            const mProgress = totalPoints > 0 
                ? Math.round(linkedStories.reduce((acc, s) => acc + (storyProgressMap[s.id] || 0) * (s.points || 1), 0) / totalPoints)
                : 0;

            return (
                <Card 
                    key={m.id} 
                    className="relative cursor-pointer hover:border-primary transition-all hover:shadow-md border-t-4"
                    style={{ borderTopColor: m.status === 'Completed' ? '#22c55e' : m.status === 'Active' ? '#2563eb' : '#94a3b8' }}
                    onClick={() => setViewMilestone(m)}
                >
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{m.title}</CardTitle>
                            <Badge variant={m.status === 'Completed' ? 'default' : m.status === 'Active' ? 'secondary' : 'outline'}>{m.status}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-primary">
                                <span>PROGRESS</span>
                                <span>{mProgress}%</span>
                            </div>
                            <ProgressBar progress={mProgress} />
                        </div>
                        <div className="flex flex-col gap-2 text-xs text-muted-foreground bg-slate-50 p-2 rounded">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Start: {m.startDate}</div>
                                <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> End: {m.endDate}</div>
                            </div>
                        </div>
                         {user?.isAdmin && (
                            <div className="absolute bottom-2 right-2 flex gap-1 rounded">
                               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => onEdit(m, e)}><Edit2 className="h-3 w-3" /></Button>
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => onDelete(m.id, e)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                         )}
                    </CardContent>
                </Card>
            )
        })}
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
          <div className="space-y-2">
            <Label>Linked User Stories</Label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input 
                    placeholder="Search stories..." 
                    className="pl-10" 
                    value={storySearch} 
                    onChange={e => setStorySearch(e.target.value)} 
                />
            </div>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                {filteredStoriesForSearch.map(s => (
                    <div key={s.id} className="flex items-center space-x-2 hover:bg-muted/50 p-1 rounded cursor-pointer" onClick={() => toggleStory(s.id)}>
                        <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded border-gray-300 pointer-events-none"
                            checked={selectedStoryIds.includes(s.id)}
                            readOnly
                        />
                        <div className="flex flex-col overflow-hidden flex-1">
                            <span className="text-sm font-medium truncate">{s.displayId ? `[${s.displayId}] ` : ''}{s.title}</span>
                            <span className="text-xs text-muted-foreground truncate">{s.backlogTitle}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{s.points} pts</Badge>
                    </div>
                ))}
            </div>
          </div>
          <DialogFooter><Button type="submit">{editingId ? "Update" : "Create"}</Button></DialogFooter>
        </form>
      </Dialog>
      
      <MilestoneDetailModal 
          milestone={viewMilestone}
          isOpen={!!viewMilestone}
          onClose={() => setViewMilestone(null)}
          allStories={allStories}
          teams={teams}
          usersList={usersList}
          storyProgressMap={storyProgressMap}
      />
    </div>
  );
};

// --- Tasks View (Kanban) ---
export const TasksView = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [allStories, setAllStories] = useState<UserStory[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    
    // Filters
    const [filterSelf, setFilterSelf] = useState(false);
    const [filterStack, setFilterStack] = useState<string>('All');
    const [filterPanel, setFilterPanel] = useState<string>('All');
    const [filterTeam, setFilterTeam] = useState<string>('All');
    const [filterAssignee, setFilterAssignee] = useState<string>('All');
    
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const fetchData = async () => {
        try {
          const [tSnap, tmSnap, uSnap, blSnap] = await Promise.all([
              getDocs(collection(db, "tasks")),
              getDocs(collection(db, "teams")),
              getDocs(collection(db, "users")),
              getDocs(collection(db, "product_backlogs"))
          ]);

          setTasks(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
          setTeams(tmSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
          setUsersList(uSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
          
          // Fetch all user stories for reference
          const storiesPromises = blSnap.docs.map(async (blDoc) => {
            const sSnap = await getDocs(collection(db, `product_backlogs/${blDoc.id}/user_stories`));
            return sSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserStory));
          });
          const allStoriesFlat = (await Promise.all(storiesPromises)).flat();
          setAllStories(allStoriesFlat);

        } catch (error) {
          console.error(error);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const COLUMNS: Task['status'][] = ['To Do', 'In Progress', 'Testing', 'Review', 'Done'];

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, newStatus: Task['status']) => {
        e.preventDefault();
        if (!draggedTaskId || !user) return;

        const task = tasks.find(t => t.id === draggedTaskId);
        if (!task || task.status === newStatus) {
            setDraggedTaskId(null);
            return;
        }

        const updatedTask = { ...task, status: newStatus };
        setTasks(prev => prev.map(t => t.id === draggedTaskId ? updatedTask : t));
        setDraggedTaskId(null);

        const now = Date.now();
        const updates: any = { 
            status: newStatus,
            history: [...(task.history || []), { status: newStatus, timestamp: now, userId: user.id, userName: user.name }]
        };

        if (newStatus === 'In Progress' && !task.startTime) updates.startTime = now;
        if (newStatus === 'Done') updates.endTime = now;
        if (task.status === 'Done' && newStatus !== 'Done') updates.endTime = null;

        try {
            await updateDoc(doc(db, "tasks", task.id), updates);
        } catch (error) {
            console.error("Failed to update task status:", error);
            fetchData();
        }
    };

    const filteredTasks = tasks.filter(t => {
        const matchStack = filterStack === 'All' || t.stack === filterStack;
        const matchPanel = filterPanel === 'All' || t.panel === filterPanel;
        
        let mTeam = true;
        if (filterTeam === 'All') mTeam = true;
        else if (filterTeam === 'No Team') mTeam = !t.teamId;
        else mTeam = t.teamId === filterTeam;

        let mAssignee = true;
        if (filterSelf && user) {
            mAssignee = t.assigneeId === user.id;
        } else {
             if (filterAssignee === 'All') mAssignee = true;
             else if (filterAssignee === 'Unassigned') mAssignee = !t.assigneeId;
             else mAssignee = t.assigneeId === filterAssignee;
        }
        
        return matchStack && matchPanel && mTeam && mAssignee;
    });

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col space-y-4">
             <div className="flex flex-col space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold tracking-tight">Task Board</h2>
                    <Button variant="outline" size="sm" onClick={fetchData}><History className="mr-2 h-4 w-4" /> Refresh</Button>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-md border shadow-sm">
                    <Filter className="h-4 w-4 text-muted-foreground mr-2" />
                    
                    <select 
                        className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer"
                        value={filterStack}
                        onChange={(e) => setFilterStack(e.target.value)}
                    >
                        <option value="All">All Stacks</option>
                        <option value="Frontend">Frontend</option>
                        <option value="Backend">Backend</option>
                    </select>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>

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
                        className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer max-w-[150px] truncate"
                        value={filterTeam}
                        onChange={(e) => setFilterTeam(e.target.value)}
                    >
                        <option value="All">All Teams</option>
                        <option value="No Team">No Team</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>

                    <select 
                        className="text-sm border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer max-w-[150px] truncate disabled:opacity-50"
                        value={filterAssignee}
                        onChange={(e) => {
                            setFilterAssignee(e.target.value);
                            setFilterSelf(false);
                        }}
                        disabled={filterSelf}
                    >
                        <option value="All">All Members</option>
                        <option value="Unassigned">Unassigned</option>
                        {usersList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>

                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    
                     <div className="flex items-center space-x-2">
                        <input 
                            id="my-tasks" 
                            type="checkbox" 
                            checked={filterSelf} 
                            onChange={e => {
                                setFilterSelf(e.target.checked);
                                if(e.target.checked) setFilterAssignee('All');
                            }} 
                            className="h-4 w-4" 
                        />
                        <Label htmlFor="my-tasks" className="cursor-pointer text-xs">My Tasks Only</Label>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-4 min-w-[1000px] pb-4">
                    {COLUMNS.map(status => (
                        <div 
                            key={status} 
                            className={`flex-1 min-w-[280px] bg-muted/30 rounded-lg flex flex-col max-h-full transition-colors ${draggedTaskId ? 'border-2 border-dashed border-transparent hover:border-primary/20' : ''}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, status)}
                        >
                             <div className="p-3 font-semibold text-sm text-muted-foreground flex justify-between items-center bg-muted/50 rounded-t-lg select-none">
                                {status}
                                <span className="bg-background px-2 py-0.5 rounded-full text-xs border">{filteredTasks.filter(t => t.status === status).length}</span>
                             </div>
                             <div className="p-2 space-y-2 overflow-y-auto flex-1">
                                {filteredTasks.filter(t => t.status === status).map(task => {
                                    const story = allStories.find(s => s.id === task.userStoryId);
                                    return (
                                        <div 
                                            key={task.id} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}
                                            className={`bg-background p-3 rounded border shadow-sm cursor-pointer hover:border-primary transition-all space-y-2 group ${draggedTaskId === task.id ? 'opacity-50 ring-2 ring-primary ring-offset-2' : ''}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className="text-xs font-mono text-muted-foreground truncate">{task.stack}</span>
                                                {task.panel && (
                                                   <Badge variant="outline" className="text-[10px] h-4 px-1">{task.panel}</Badge>
                                                )}
                                            </div>
                                            
                                            {/* Linked Story Badge & Preview on Card */}
                                            {story && (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100 truncate" title={story.title}>
                                                        <Layout className="h-2.5 w-2.5 shrink-0" />
                                                        <span className="truncate">{story.displayId ? `${story.displayId}: ` : ''}{story.title}</span>
                                                    </div>
                                                    {story.description && (
                                                        <div className="text-[10px] text-muted-foreground/80 line-clamp-1 italic px-0.5" dir="auto">
                                                            {story.description.replace(/[#*`]/g, '')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <p className="text-sm font-medium line-clamp-2" dir="auto">{task.title}</p>
                                            <div className="flex justify-between items-center pt-1">
                                                 <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <UserIcon className="h-3 w-3" />
                                                    <span className="max-w-[80px] truncate">{usersList.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}</span>
                                                 </div>
                                                 {task.comments && task.comments.length > 0 && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                                            </div>
                                        </div>
                                    );
                                })}
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
                allStories={allStories}
            />
        </div>
    );
};