
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Card, Switch, Badge } from '../ui';
import { Team, User } from '../../types';
import { Plus, Trash2, Edit2, Users as UsersIcon, Search, Loader2, CheckCircle2, AlertCircle, Info, X, GitBranch } from 'lucide-react';
import { usersApi, teamsApi } from '../../api/admin';

// --- Local UI Components ---

const Notification = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800"
  };

  const Icons = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    error: <AlertCircle className="h-4 w-4 text-red-500" />,
    info: <Info className="h-4 w-4 text-blue-500" />
  };

  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-right-full duration-300 ${styles[type]}`}>
      {Icons[type]}
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="ml-2 text-current opacity-50 hover:opacity-100">&times;</button>
    </div>
  );
};

// Added key?: React.Key to the props definition of SkeletonRow to resolve "property 'key' does not exist" errors when used in a list.
const SkeletonRow = ({ cols }: { cols: number; key?: React.Key }) => (
  <TableRow className="animate-pulse bg-slate-50/50">
    {Array.from({ length: cols }).map((_, i) => (
      <TableCell key={i}>
        <div className="h-4 bg-slate-200 rounded w-full"></div>
      </TableCell>
    ))}
  </TableRow>
);

export const UsersView = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (error) {
      setNotification({ message: "Failed to load users.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleAdmin = async (u: User) => {
    if (u.email === 'realovatsug@gmail.com') return; 
    const newStatus = !u.isAdmin;
    setUsers(prev => prev.map(user => user.id === u.id ? { ...user, isAdmin: newStatus } : user));
    try {
      await usersApi.updateAdminStatus(u.id, newStatus);
      setNotification({ message: `${u.name} is now an ${newStatus ? 'Admin' : 'User'}.`, type: 'success' });
    } catch (error) {
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, isAdmin: !newStatus } : user));
      setNotification({ message: "Role update failed.", type: 'error' });
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h2>
        <p className="text-sm text-muted-foreground">Manage roles and identifiers.</p>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="font-bold">Name</TableHead>
              <TableHead className="font-bold">Email</TableHead>
              <TableHead className="font-bold">Administrative Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={3} />)
            ) : users.map(u => (
              <TableRow key={u.id} className="hover:bg-slate-50/30 transition-colors">
                <TableCell className="font-semibold text-slate-700">{u.name}</TableCell>
                <TableCell className="text-slate-500 font-mono text-xs">{u.email}</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Switch 
                      checked={u.isAdmin} 
                      onCheckedChange={() => toggleAdmin(u)} 
                      disabled={u.email === 'realovatsug@gmail.com'}
                    />
                    <Badge variant={u.isAdmin ? "default" : "outline"} className={u.isAdmin ? "bg-primary" : "text-slate-400"}>
                      {u.isAdmin ? 'Full Admin' : 'Standard User'}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export const TeamsView = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [repoInput, setRepoInput] = useState("");
  
  const { register, handleSubmit, reset, setValue, watch } = useForm<Team>();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [repositories, setRepositories] = useState<string[]>([]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsData, usersData] = await Promise.all([
        teamsApi.getAll(),
        usersApi.getAll()
      ]);
      setTeams(teamsData);
      setUsers(usersData);
    } catch (error) {
      setNotification({ message: "Sync failed.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onEdit = (t: Team) => {
    setEditingId(t.id);
    setValue("name", t.name);
    setValue("description", t.description);
    setValue("leaderId", t.leaderId);
    setRepositories(t.repositories || []);
    setSelectedMembers(t.memberIds || []);
    setMemberSearch("");
    setRepoInput("");
    setIsDialogOpen(true);
  };

  const addRepository = () => {
    if (!repoInput.trim()) return;
    if (repositories.includes(repoInput.trim())) {
      setRepoInput("");
      return;
    }
    setRepositories([...repositories, repoInput.trim()]);
    setRepoInput("");
  };

  const removeRepository = (name: string) => {
    setRepositories(repositories.filter(r => r !== name));
  };

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const payload = { ...data, id: editingId, repositories };
      await teamsApi.save(payload, selectedMembers);
      
      setNotification({ message: `Team "${data.name}" saved.`, type: 'success' });
      setIsDialogOpen(false);
      reset();
      setRepositories([]);
      setSelectedMembers([]);
      setEditingId(null);
      await loadData();
    } catch (error) {
      setNotification({ message: "Save failed.", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteTeam = async (id: string) => {
    if (confirm('Delete this team?')) {
        setDeletingId(id);
        try {
          await teamsApi.delete(id);
          setTeams(prev => prev.filter(t => t.id !== id));
          setNotification({ message: "Team removed.", type: 'info' });
        } catch (error) {
          setNotification({ message: "Deletion failed.", type: 'error' });
        } finally {
          setDeletingId(null);
        }
    }
  }

  const toggleMember = (uid: string) => {
      setSelectedMembers(prev => 
          prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
      );
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Organizational Teams</h2>
          <p className="text-sm text-muted-foreground">Manage work groups and repositories.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setSelectedMembers([]); setRepositories([]); setRepoInput(""); setMemberSearch(""); reset(); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Team
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="font-bold">Team Name</TableHead>
              <TableHead className="font-bold">Lead</TableHead>
              <TableHead className="font-bold">Repos</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
            ) : teams.map(t => (
              <TableRow key={t.id} className="hover:bg-slate-50/30 transition-colors group">
                <TableCell className="font-bold text-slate-800">{t.name}</TableCell>
                <TableCell className="text-sm text-slate-600">
                   {users.find(u => u.id === t.leaderId)?.name || '-'}
                </TableCell>
                <TableCell>
                   <div className="flex flex-wrap gap-1">
                      {t.repositories?.map((r, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-slate-50 flex items-center gap-1">
                          <GitBranch className="h-2 w-2" /> {r}
                        </Badge>
                      ))}
                      {(!t.repositories || t.repositories.length === 0) && <span className="text-xs text-slate-400">No repos</span>}
                   </div>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end space-x-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(t)} className="h-8 w-8"><Edit2 className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTeam(t.id)} disabled={deletingId === t.id}>
                          {deletingId === t.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                        </Button>
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader className="border-b pb-4">
          <DialogTitle>{editingId ? "Edit Team" : "New Team"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Name</Label>
                <Input {...register('name', {required: true})} placeholder="Team Name" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Lead</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('leaderId', {required: true})}>
                    <option value="">Choose...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Repositories</Label>
              <div className="flex gap-2">
                <Input 
                  value={repoInput} 
                  onChange={(e) => setRepoInput(e.target.value)} 
                  placeholder="e.g. backend-api" 
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRepository())}
                />
                <Button type="button" variant="outline" onClick={addRepository}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {repositories.map(r => (
                  <Badge key={r} variant="secondary" className="flex items-center gap-1.5 py-1 px-2">
                    {r}
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeRepository(r)} />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Members</Label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="Search members..." className="pl-9 h-9 text-sm" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-1 bg-slate-50/50 space-y-0.5">
                    {filteredUsers.map(u => (
                        <div key={u.id} className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${selectedMembers.includes(u.id) ? 'bg-white border-primary/20 shadow-sm' : 'hover:bg-white'}`} onClick={() => toggleMember(u.id)}>
                            <div className="flex items-center gap-3">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedMembers.includes(u.id) ? 'bg-primary text-white' : 'bg-slate-200'}`}>{u.name.charAt(0)}</div>
                              <span className="text-xs font-medium">{u.name}</span>
                            </div>
                            {selectedMembers.includes(u.id) && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                    ))}
                </div>
            </div>

            <DialogFooter className="pt-6 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Team" : "Create Team"}
              </Button>
            </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
