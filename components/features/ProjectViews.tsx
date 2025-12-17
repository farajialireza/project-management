import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Badge, Card, CardHeader, CardTitle, CardContent } from '../ui';
import { ProductBacklog, UserStory, Milestone, Task, Team, User } from '../../types';
import { Plus, Trash2, Edit2, CheckCircle, Clock } from 'lucide-react';
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

// --- Stories View ---
export const StoriesView = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<(UserStory & { backlogTitle?: string })[]>([]);
  const [backlogs, setBacklogs] = useState<ProductBacklog[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<UserStory>();

  const fetchData = async () => {
    const blSnap = await getDocs(collection(db, "product_backlogs"));
    const bls = blSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductBacklog));
    setBacklogs(bls);

    let allStories: (UserStory & { backlogTitle?: string })[] = [];
    for (const bl of bls) {
      const storySnap = await getDocs(collection(db, `product_backlogs/${bl.id}/user_stories`));
      const s = storySnap.docs.map(d => ({ id: d.id, backlogTitle: bl.title, ...d.data() } as UserStory & { backlogTitle: string }));
      allStories = [...allStories, ...s];
    }
    // Sort by displayId if available, else by title
    allStories.sort((a, b) => (a.displayId || "").localeCompare(b.displayId || "") || a.title.localeCompare(b.title));
    setStories(allStories);
  };

  useEffect(() => { fetchData(); }, []);

  const onSubmit = async (data: any) => {
    const { backlogId, ...rest } = data;
    await addDoc(collection(db, `product_backlogs/${backlogId}/user_stories`), rest);
    setIsDialogOpen(false);
    reset();
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">User Stories</h2>
        {user?.isAdmin && <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Story</Button>}
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Backlog</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stories.map(story => (
              <TableRow key={story.id}>
                 <TableCell className="font-mono text-xs">{story.displayId || '-'}</TableCell>
                <TableCell className="font-medium">
                    {story.title}
                    <div className="text-xs text-muted-foreground truncate max-w-[300px]">{story.description}</div>
                </TableCell>
                <TableCell>{story.role || '-'}</TableCell>
                <TableCell>{story.backlogTitle}</TableCell>
                <TableCell>
                  <Badge variant={story.priority === 'High' ? 'destructive' : story.priority === 'Medium' ? 'default' : 'secondary'}>
                    {story.priority}
                  </Badge>
                </TableCell>
                <TableCell>{story.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader><DialogTitle>Add User Story</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Backlog (Parent)</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('backlogId', { required: true })}>
              <option value="">Select Backlog</option>
              {backlogs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>ID (Optional)</Label>
                <Input {...register('displayId')} placeholder="e.g. PB-001" />
            </div>
            <div className="space-y-2">
                <Label>Role (Optional)</Label>
                <Input {...register('role')} placeholder="e.g. Admin" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register('title', { required: true })} placeholder="e.g. Manage Employees" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...register('description')} placeholder="As an admin, I want to..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('priority')}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Points</Label>
              <Input type="number" {...register('points')} defaultValue={1} />
            </div>
          </div>
          <DialogFooter><Button type="submit">Create</Button></DialogFooter>
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
  const [users, setUsers] = useState<User[]>([]); // For assignee
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm<Task>();

  const loadData = useCallback(async () => {
    if (!user) return;

    // Fetch teams user belongs to
    const teamsSnap = await getDocs(collection(db, "teams"));
    const allTeams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
    const userTeams = user.isAdmin ? allTeams : allTeams.filter(t => t.memberIds.includes(user.id));
    setTeams(userTeams);

    const userTeamsIds = userTeams.map(t => t.id);
    if (userTeamsIds.length === 0) { setTasks([]); return; }

    let q;
    if (userTeamsIds.length <= 10) {
        q = query(collection(db, "tasks"), where("teamId", "in", userTeamsIds));
    } else {
        q = query(collection(db, "tasks"));
    }
    
    const tasksSnap = await getDocs(q);
    const fetchedTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
    setTasks(userTeamsIds.length <= 10 ? fetchedTasks : fetchedTasks.filter(t => userTeamsIds.includes(t.teamId)));

    // Fetch Users and Milestones for dropdowns
    const uSnap = await getDocs(collection(db, "users"));
    setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    const mSnap = await getDocs(collection(db, "milestones"));
    setMilestones(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onSubmit = async (data: any) => {
    await addDoc(collection(db, "tasks"), { ...data, createdAt: Date.now() });
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

  // Check if user is leader of any team or admin
  const canAdd = user?.isAdmin || teams.some(t => t.leaderId === user?.id);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
        {canAdd && <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Task</Button>}
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
                  <TableCell>{team?.name || 'Unknown'}</TableCell>
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
           <div className="space-y-2">
            <Label>Team</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('teamId', { required: true })}>
              <option value="">Select Team</option>
              {teams.filter(t => user?.isAdmin || t.leaderId === user?.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
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
               <Label>Assignee</Label>
               <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('assigneeId')}>
                <option value="">Unassigned</option>
                {availableAssignees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
           <div className="space-y-2">
             <Label>Milestone</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('milestoneId')}>
                <option value="">None</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
           </div>
          <DialogFooter><Button type="submit">Create Task</Button></DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
