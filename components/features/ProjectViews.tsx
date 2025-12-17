import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Badge, Card, CardHeader, CardTitle, CardContent } from '../ui';
import { ProductBacklog, UserStory, Milestone, Task, Team, User } from '../../types';
import { Plus, Trash2, Edit2, CheckCircle, Clock, ChevronDown, ChevronRight, ListTodo } from 'lucide-react';
import { useAuth } from '../../App';

// --- Backlogs View ---
export const BacklogsView = () => {
  const { user } = useAuth();
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue } = useForm<ProductBacklog>();

  const fetchBacklogs = async () => {
    const querySnapshot = await getDocs(collection(db, "product_backlogs"));
    const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProductBacklog));
    // Sort by displayId if present
    data.sort((a, b) => (a.displayId || "").localeCompare(b.displayId || "") || a.title.localeCompare(b.title));
    setBacklogs(data);
  };

  useEffect(() => { fetchBacklogs(); }, []);

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click events if any
    
    if (confirm("Are you sure you want to delete this backlog? All stories inside it will be lost.")) {
      try {
        // Cascading delete: Delete all stories in the subcollection first
        const storiesRef = collection(db, "product_backlogs", id, "user_stories");
        const storiesSnap = await getDocs(storiesRef);
        
        const batch = writeBatch(db);
        
        // Delete all stories found
        storiesSnap.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        // Delete the backlog itself
        const backlogRef = doc(db, "product_backlogs", id);
        batch.delete(backlogRef);
        
        await batch.commit();
        
        // Update UI immediately
        setBacklogs(prev => prev.filter(b => b.id !== id));
      } catch (error) {
        console.error("Error deleting backlog:", error);
        alert("Failed to delete backlog. Check console for details.");
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
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Product Backlogs</h2>
        {user?.isAdmin && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Backlog</Button>}
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Description</TableHead>
              {user?.isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {backlogs.map(bl => (
              <TableRow key={bl.id}>
                <TableCell className="font-mono text-xs">{bl.displayId || '-'}</TableCell>
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
            {backlogs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No backlogs found.</TableCell></TableRow>}
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
               <Label>Role</Label>
               <Input {...register('role')} placeholder="e.g. Admin" />
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
           <div className="space-y-2">
            <Label>Priority</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('priority')}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="submit">{editingId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};

// --- Stories View (Hierarchical) ---
export const StoriesView = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<(UserStory & { backlogTitle?: string })[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  
  // Dialog States
  const [isStoryDialogOpen, setIsStoryDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [targetStory, setTargetStory] = useState<UserStory | null>(null);
  
  const { register: regStory, handleSubmit: subStory, reset: resetStory } = useForm<UserStory>();
  const { register: regTask, handleSubmit: subTask, reset: resetTask } = useForm<Task>();

  const fetchData = async () => {
    // 1. Fetch Backlogs
    const blSnap = await getDocs(collection(db, "product_backlogs"));
    const bls = blSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductBacklog));
    setBacklogs(bls);

    // 2. Fetch Stories
    let allStories: (UserStory & { backlogTitle?: string })[] = [];
    for (const bl of bls) {
      const storySnap = await getDocs(collection(db, `product_backlogs/${bl.id}/user_stories`));
      const s = storySnap.docs.map(d => ({ id: d.id, backlogTitle: bl.title, ...d.data() } as UserStory & { backlogTitle: string }));
      allStories = [...allStories, ...s];
    }
    allStories.sort((a, b) => (a.displayId || "").localeCompare(b.displayId || "") || a.title.localeCompare(b.title));
    setStories(allStories);

    // 3. Fetch Tasks
    const tasksSnap = await getDocs(collection(db, "tasks"));
    setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
  };

  useEffect(() => { fetchData(); }, []);

  const onAddStory = async (data: any) => {
    const { backlogId, ...rest } = data;
    await addDoc(collection(db, `product_backlogs/${backlogId}/user_stories`), rest);
    setIsStoryDialogOpen(false);
    resetStory();
    fetchData();
  };

  const onAddTask = async (data: any) => {
    if (!targetStory) return;
    await addDoc(collection(db, "tasks"), { 
      ...data, 
      userStoryId: targetStory.id,
      backlogId: targetStory.backlogId,
      status: 'To Do',
      createdAt: Date.now() 
    });
    setIsTaskDialogOpen(false);
    resetTask();
    fetchData();
    // Auto expand the story we just added a task to
    setExpandedStoryId(targetStory.id);
  };

  const openAddTask = (story: UserStory, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetStory(story);
    setIsTaskDialogOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedStoryId(expandedStoryId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">User Stories & Tasks</h2>
        {user?.isAdmin && <Button onClick={() => setIsStoryDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Story</Button>}
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
            {stories.map(story => {
              const storyTasks = tasks.filter(t => t.userStoryId === story.id);
              const isExpanded = expandedStoryId === story.id;
              
              return (
                <React.Fragment key={story.id}>
                  <TableRow className={isExpanded ? "bg-muted/50 border-b-0" : "cursor-pointer"} onClick={() => toggleExpand(story.id)}>
                    <TableCell>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{story.displayId || '-'}</TableCell>
                    <TableCell className="font-medium">
                        {story.title}
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">{story.description}</div>
                    </TableCell>
                    <TableCell>{story.backlogTitle}</TableCell>
                    <TableCell>
                      <Badge variant={story.priority === 'High' ? 'destructive' : story.priority === 'Medium' ? 'default' : 'secondary'}>
                        {story.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <Button variant="outline" size="sm" onClick={(e) => openAddTask(story, e)}>
                         <ListTodo className="h-3 w-3 mr-2" /> Add Task
                       </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6} className="p-0">
                        <div className="p-4 pl-12 space-y-2">
                           <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                             <ListTodo className="h-4 w-4" /> Tasks ({storyTasks.length})
                           </h4>
                           {storyTasks.length === 0 ? (
                             <p className="text-xs text-muted-foreground italic">No tasks yet.</p>
                           ) : (
                             <div className="grid gap-2">
                               {storyTasks.map(task => (
                                 <div key={task.id} className="flex items-center justify-between bg-background p-2 rounded border text-sm">
                                   <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${task.status === 'Done' ? 'bg-green-500' : task.status === 'In Progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                      <span>{task.title}</span>
                                   </div>
                                   <Badge variant="outline" className="text-[10px]">{task.status}</Badge>
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

      {/* Story Modal */}
      <Dialog open={isStoryDialogOpen} onOpenChange={setIsStoryDialogOpen}>
        <DialogHeader><DialogTitle>Add User Story</DialogTitle></DialogHeader>
        <form onSubmit={subStory(onAddStory)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Backlog (Parent)</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...regStory('backlogId', { required: true })}>
              <option value="">Select Backlog</option>
              {backlogs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
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
          <DialogFooter><Button type="submit">Create Story</Button></DialogFooter>
        </form>
      </Dialog>

      {/* Task Modal (Attached to Story) */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogHeader><DialogTitle>Add Task to: {targetStory?.title}</DialogTitle></DialogHeader>
        <form onSubmit={subTask(onAddTask)} className="space-y-4 py-4">
          <div className="space-y-2"><Label>Task Title</Label><Input {...regTask('title', { required: true })} /></div>
          <div className="space-y-2"><Label>Description</Label><Input {...regTask('description')} /></div>
          <DialogFooter><Button type="submit">Create Task</Button></DialogFooter>
        </form>
      </Dialog>
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
    const q = await getDocs(collection(db, "milestones"));
    setMilestones(q.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));
  };

  useEffect(() => { fetchMilestones(); }, []);

  const onDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this milestone?")) {
      await deleteDoc(doc(db, "milestones", id));
      fetchMilestones();
    }
  };

  const onEdit = (m: Milestone) => {
    setEditingId(m.id);
    setValue("title", m.title);
    setValue("description", m.description);
    setValue("startDate", m.startDate);
    setValue("endDate", m.endDate);
    setValue("status", m.status);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    if (editingId) {
      await updateDoc(doc(db, "milestones", editingId), data);
    } else {
      await addDoc(collection(db, "milestones"), data);
    }
    setIsDialogOpen(false);
    setEditingId(null);
    reset();
    fetchMilestones();
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
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              {user?.isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.title}</TableCell>
                <TableCell>{m.startDate}</TableCell>
                <TableCell>{m.endDate}</TableCell>
                <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                {user?.isAdmin && (
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(m)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(m.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
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

// --- Tasks View ---
export const TasksView = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  
  // Selection State for cascading dropdowns
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [selectedBacklogId, setSelectedBacklogId] = useState<string>("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm<Task>();

  const loadData = useCallback(async () => {
    if (!user) return;

    // Load Tasks
    const tasksSnap = await getDocs(collection(db, "tasks"));
    setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));

    // Load Dropdown Data
    const tSnap = await getDocs(collection(db, "teams"));
    setTeams(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));

    const uSnap = await getDocs(collection(db, "users"));
    setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));

    const mSnap = await getDocs(collection(db, "milestones"));
    setMilestones(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));

    const bSnap = await getDocs(collection(db, "product_backlogs"));
    setBacklogs(bSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductBacklog)));

  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // When Backlog selection changes in the form, fetch its stories
  useEffect(() => {
    if (selectedBacklogId) {
       const fetchStories = async () => {
          const sSnap = await getDocs(collection(db, `product_backlogs/${selectedBacklogId}/user_stories`));
          setStories(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserStory)));
       };
       fetchStories();
    } else {
       setStories([]);
    }
  }, [selectedBacklogId]);

  const onSubmit = async (data: any) => {
    // data.userStoryId comes from form. We need to fetch backlogId from selectedBacklogId state for consistency
    await addDoc(collection(db, "tasks"), { ...data, backlogId: selectedBacklogId, createdAt: Date.now() });
    setIsDialogOpen(false);
    reset();
    loadData();
  };

  const selectedTeamId = watch("teamId");
  const availableAssignees = users.filter(u => {
    if (!selectedTeamId) return false;
    const team = teams.find(t => t.id === selectedTeamId);
    return team?.memberIds.includes(u.id);
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Task</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(t => {
              const team = teams.find(tm => tm.id === t.teamId);
              const assignee = users.find(u => u.id === t.assigneeId);
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>{team?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === 'Done' ? 'default' : 'secondary'}>{t.status}</Badge>
                  </TableCell>
                  <TableCell>{assignee?.name || 'Unassigned'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          
          {/* Hierarchy Selection */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4">
             <div className="space-y-2">
               <Label>1. Select Backlog</Label>
               <select 
                 className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                 value={selectedBacklogId}
                 onChange={(e) => setSelectedBacklogId(e.target.value)}
                 required
               >
                 <option value="">Select Backlog</option>
                 {backlogs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
               </select>
             </div>
             <div className="space-y-2">
               <Label>2. Select User Story</Label>
               <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('userStoryId', { required: true })} disabled={!selectedBacklogId}>
                 <option value="">Select Story</option>
                 {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
               </select>
             </div>
          </div>

          <div className="space-y-2"><Label>Title</Label><Input {...register('title', { required: true })} /></div>
          <div className="space-y-2"><Label>Description</Label><Input {...register('description')} /></div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
               <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('status')}>
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            </div>
             <div className="space-y-2">
               <Label>Milestone</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('milestoneId')}>
                  <option value="">None</option>
                  {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
             </div>
          </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label>Team</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('teamId')}>
                <option value="">No Team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
               <Label>Assignee</Label>
               <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('assigneeId')}>
                <option value="">Unassigned</option>
                {availableAssignees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <DialogFooter><Button type="submit">Create Task</Button></DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
