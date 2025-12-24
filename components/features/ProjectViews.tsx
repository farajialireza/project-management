
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, writeBatch, query, where, collectionGroup } from 'firebase/firestore';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Badge, Card, CardHeader, CardTitle, CardContent, Textarea } from '../ui';
import { ProductBacklog, UserStory, Milestone, Task, Team, User, TaskComment, AssignmentHistory } from '../../types';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, ListTodo, Sparkles, MessageSquare, History, User as UserIcon, Users as UsersIcon, Clock, Loader2, CheckCircle, Save, X, Filter, Search, Calendar, Layout, BarChart3, FileText, Info, UserPlus, Users, GripVertical } from 'lucide-react';
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
            const now = Date.now();
            const newAssignmentHistory: AssignmentHistory[] = [...(task.assignmentHistory || [])];

            // Track Team Assignment Changes
            if (editForm.teamId !== task.teamId) {
                const newTeamName = editForm.teamId ? (teams.find(t => t.id === editForm.teamId)?.name || 'Unknown Team') : 'Unassigned (None)';
                newAssignmentHistory.push({
                    type: 'Team',
                    assignedToId: editForm.teamId || '',
                    assignedToName: newTeamName,
                    assignedById: user.id,
                    assignedByName: user.name,
                    timestamp: now
                });
            }

            // Track Member Assignment Changes
            if (editForm.assigneeId !== task.assigneeId) {
                const newMemberName = editForm.assigneeId ? (usersList.find(u => u.id === editForm.assigneeId)?.name || 'Unknown User') : 'Unassigned (None)';
                newAssignmentHistory.push({
                    type: 'Member',
                    assignedToId: editForm.assigneeId || '',
                    assignedToName: newMemberName,
                    assignedById: user.id,
                    assignedByName: user.name,
                    timestamp: now
                });
            }

            const updates = {
                ...editForm,
                assignmentHistory: newAssignmentHistory,
                lastEditedBy: {
                    userId: user.id,
                    userName: user.name,
                    timestamp: now
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
                            
                            {/* NEW ASSIGNMENT HISTORY SECTION */}
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
                                                <span className="flex items-center gap-1">Assigned by: <b>{ah.assignedByName}</b></span>
                                                <span className="flex items-center gap-1 mt-0.5"><Clock className="h-2.5 w-2.5" /> {new Date(ah.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!task.assignmentHistory || task.assignmentHistory.length === 0) && (
                                        <div className="text-[10px] text-muted-foreground italic p-2 border border-dashed rounded text-center">No assignments recorded.</div>
                                    )}
                                </div>
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
  const [filterPanel, setFilterPanel] = useState<string>('All');

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
    const now = Date.now();
    const assignmentHistory: AssignmentHistory[] = [];

    // Track initial Team assignment
    if (data.teamId) {
        assignmentHistory.push({
            type: 'Team',
            assignedToId: data.teamId,
            assignedToName: teams.find(t => t.id === data.teamId)?.name || 'Team',
            assignedById: user?.id || 'system',
            assignedByName: user?.name || 'System',
            timestamp: now
        });
    }

    // Track initial Member assignment
    if (data.assigneeId) {
        assignmentHistory.push({
            type: 'Member',
            assignedToId: data.assigneeId,
            assignedToName: usersList.find(u => u.id === data.assigneeId)?.name || 'User',
            assignedById: user?.id || 'system',
            assignedByName: user?.name || 'System',
            timestamp: now
        });
    }

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
        createdAt: now,
        history: [{
            status: 'To Do',
            timestamp: now,
            userId: user?.id || 'system',
            userName: user?.name || 'System'
        }],
        assignmentHistory: assignmentHistory,
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
            const now = Date.now();
            
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
                    createdAt: now,
                    history: [{
                        status: 'To Do',
                        timestamp: now,
                        userId: user?.id || 'ai',
                        userName: user?.name || 'AI Assistant'
                    }],
                    assignmentHistory: [],
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
    const matchPanel = filterPanel === 'All' || story.panel === filterPanel;
    return matchBacklog && matchPriority && matchPanel;
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

// --- Milestones View ---
export const MilestonesView = () => {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue } = useForm<Milestone>();

  const fetchMilestones = async () => {
    try {
      const snap = await getDocs(collection(db, "milestones"));
      setMilestones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));
    } catch (error) {
      console.error("Error fetching milestones:", error);
    }
  };

  useEffect(() => { fetchMilestones(); }, []);

  const onSubmit = async (data: any) => {
    try {
      if (editingId) {
        await updateDoc(doc(db, "milestones", editingId), data);
      } else {
        await addDoc(collection(db, "milestones"), data);
      }
      setIsDialogOpen(false);
      reset();
      setEditingId(null);
      fetchMilestones();
    } catch (error) {
      console.error("Error saving milestone:", error);
      alert("Failed to save milestone.");
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

  const onDelete = async (id: string) => {
    if(confirm('Delete milestone?')) {
        try {
          await deleteDoc(doc(db, "milestones", id));
          fetchMilestones();
        } catch (error) {
          console.error("Delete failed:", error);
        }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Milestones</h2>
        {user?.isAdmin && <Button onClick={() => { setEditingId(null); reset(); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Milestone</Button>}
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              {user?.isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.startDate} - {m.endDate}</TableCell>
                <TableCell><Badge>{m.status}</Badge></TableCell>
                {user?.isAdmin && (
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(m)}><Edit2 className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(m.id)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {milestones.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">No milestones found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader><DialogTitle>{editingId ? "Edit" : "Create"} Milestone</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2"><Label>Title</Label><Input {...register('title', {required: true})} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea {...register('description')} /></div>
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
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </Dialog>
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [allStories, setAllStories] = useState<UserStory[]>([]);

  // Filter States
  const [filterTeam, setFilterTeam] = useState<string>('All');
  const [filterStack, setFilterStack] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterAssignee, setFilterAssignee] = useState<string>('All');
  const [filterPanel, setFilterPanel] = useState<string>('All');

  const STATUSES: Task['status'][] = ['To Do', 'In Progress', 'Testing', 'Review', 'Done'];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tasksSnap, teamsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "tasks")),
        getDocs(collection(db, "teams")),
        getDocs(collection(db, "users"))
      ]);

      setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
      setUsersList(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      
      const blSnap = await getDocs(collection(db, "product_backlogs"));
      const storyPromises = blSnap.docs.map(async (bl) => {
          const snap = await getDocs(collection(db, `product_backlogs/${bl.id}/user_stories`));
          return snap.docs.map(d => ({
              id: d.id,
              backlogId: bl.id,
              ...d.data()
          } as UserStory));
      });

      const storiesArrays = await Promise.all(storyPromises);
      setAllStories(storiesArrays.flat());
    } catch (e) {
      console.error("Error fetching tasks view data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const taskToUpdate = tasks.find(t => t.id === taskId);
    
    if (taskToUpdate && taskToUpdate.status !== newStatus && user) {
        // Optimistic UI Update
        const oldStatus = taskToUpdate.status;
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

        try {
            const now = Date.now();
            const updates: any = { 
                status: newStatus,
                history: [...(taskToUpdate.history || []), { status: newStatus, timestamp: now, userId: user.id, userName: user.name }]
            };
            if (newStatus === 'In Progress' && !taskToUpdate.startTime) updates.startTime = now;
            if (newStatus === 'Done') updates.endTime = now;
            
            await updateDoc(doc(db, "tasks", taskId), updates);
        } catch (error) {
            console.error("Drop update failed", error);
            // Revert on error
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: oldStatus } : t));
        }
    }
  };

  const filteredTasks = tasks.filter(task => {
      const matchTeam = filterTeam === 'All' || task.teamId === filterTeam;
      const matchStack = filterStack === 'All' || task.stack === filterStack;
      const matchStatus = filterStatus === 'All' || task.status === filterStatus;
      const matchAssignee = filterAssignee === 'All' || task.assigneeId === filterAssignee;
      const matchPanel = filterPanel === 'All' || task.panel === filterPanel;
      return matchTeam && matchStack && matchStatus && matchAssignee && matchPanel;
  });

  return (
    <div className="space-y-4 h-[calc(100vh-180px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <h2 className="text-2xl font-bold tracking-tight">Project Board</h2>
        
        {/* Advanced Filters */}
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1 shadow-sm overflow-x-auto max-w-full">
                <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                
                <select 
                    className="text-xs border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer min-w-[80px]"
                    value={filterTeam}
                    onChange={(e) => setFilterTeam(e.target.value)}
                >
                    <option value="All">All Teams</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                
                <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>

                <select 
                    className="text-xs border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer"
                    value={filterStack}
                    onChange={(e) => setFilterStack(e.target.value)}
                >
                    <option value="All">All Stacks</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Backend">Backend</option>
                </select>

                <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>

                <select 
                    className="text-xs border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer min-w-[100px]"
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                >
                    <option value="All">All Assignees</option>
                    {usersList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>

                <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>

                <select 
                    className="text-xs border-none focus:ring-0 bg-transparent text-muted-foreground font-medium outline-none cursor-pointer"
                    value={filterPanel}
                    onChange={(e) => setFilterPanel(e.target.value)}
                >
                    <option value="All">All Panels</option>
                    <option value="Admin">Admin</option>
                    <option value="Customer">Customer</option>
                </select>
            </div>
            
            <Button variant="outline" size="sm" onClick={() => {
                setFilterTeam('All');
                setFilterStack('All');
                setFilterStatus('All');
                setFilterAssignee('All');
                setFilterPanel('All');
            }} title="Reset Filters">
                <X className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
          <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start pt-2">
            {STATUSES.map(status => (
                <div 
                    key={status} 
                    className="flex-shrink-0 w-80 bg-slate-100/50 rounded-xl flex flex-col max-h-full border border-slate-200"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, status)}
                >
                    <div className="p-3 border-b flex items-center justify-between bg-slate-50/50 rounded-t-xl">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-700">{status}</span>
                            <Badge variant="secondary" className="text-[10px] h-5 bg-white border-slate-200 text-slate-600">
                                {filteredTasks.filter(t => t.status === status).length}
                            </Badge>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {filteredTasks.filter(t => t.status === status).map(task => (
                            <div 
                                key={task.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onClick={() => { setSelectedTask(task); setIsTaskDetailOpen(true); }}
                                className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-primary transition-all cursor-grab active:cursor-grabbing group relative"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex flex-wrap gap-1">
                                        <Badge variant="outline" className="text-[9px] h-4 font-normal opacity-70">{task.panel}</Badge>
                                        <Badge variant="secondary" className="text-[9px] h-4 font-normal">{task.stack}</Badge>
                                    </div>
                                    <GripVertical className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />
                                </div>
                                
                                <h3 className="text-sm font-bold text-slate-800 leading-tight mb-2 line-clamp-2" dir="auto">{task.title}</h3>
                                
                                <div className="text-[10px] text-muted-foreground truncate mb-3 bg-slate-50 p-1 rounded border border-slate-100 italic">
                                    {allStories.find(s => s.id === task.userStoryId)?.title || 'No Story context'}
                                </div>
                                
                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                            <UserIcon className="h-3 w-3 text-primary" />
                                        </div>
                                        <span className="text-[10px] font-medium">
                                            {usersList.find(u => u.id === task.assigneeId)?.name || <span className="opacity-50 italic font-normal">Unassigned</span>}
                                        </span>
                                    </div>
                                    {task.comments && task.comments.length > 0 && (
                                        <div className="flex items-center gap-1 text-slate-400">
                                            <MessageSquare className="h-3 w-3" />
                                            <span className="text-[10px] font-medium">{task.comments.length}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredTasks.filter(t => t.status === status).length === 0 && (
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center opacity-40">
                                <div className="text-xs font-medium text-slate-400">Drop tasks here</div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
          </div>
      )}

      {selectedTask && (
          <TaskDetailModal 
            task={selectedTask} 
            isOpen={isTaskDetailOpen} 
            onClose={() => setIsTaskDetailOpen(false)} 
            onUpdate={(updated) => {
                setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
                setSelectedTask(updated);
            }}
            onDelete={(id) => {
                setTasks(prev => prev.filter(t => t.id !== id));
                setIsTaskDetailOpen(false);
            }}
            teams={teams}
            usersList={usersList}
            allStories={allStories}
          />
      )}
    </div>
  );
};
