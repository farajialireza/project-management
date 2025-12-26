
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Card, Switch, Badge } from '../ui';
import { Team, User } from '../../types';
import { Plus, Trash2, Edit2, Users as UsersIcon, Search, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { usersApi, teamsApi } from '../../api/admin';

// --- Local UI Components for UX Enhancement ---

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

const SkeletonRow = ({ cols }: { cols: number }) => (
  <TableRow className="animate-pulse bg-slate-50/50">
    {Array.from({ length: cols }).map((_, i) => (
      <TableCell key={i}>
        <div className="h-4 bg-slate-200 rounded w-full"></div>
      </TableCell>
    ))}
  </TableRow>
);

/**
 * Users View: Manages user profiles and administrative roles.
 */
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
        <p className="text-sm text-muted-foreground">Assign roles and manage system permissions.</p>
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
            {!loading && users.length === 0 && (
               <TableRow>
                 <TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">No users found in the system.</TableCell>
               </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

/**
 * Teams View: Manages project teams and their relational memberships.
 */
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
  
  const { register, handleSubmit, reset, setValue } = useForm<Team>();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
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
      setNotification({ message: "Sync failed. Please refresh.", type: 'error' });
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
    setValue("repositories", t.repositories || []);
    setValue("gitlabProjectId", t.gitlabProjectId);
    setSelectedMembers(t.memberIds || []);
    setMemberSearch("");
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const payload = { ...data, id: editingId };
      await teamsApi.save(payload, selectedMembers);
      
      setNotification({ message: `Team "${data.name}" ${editingId ? 'updated' : 'created'} successfully.`, type: 'success' });
      setIsDialogOpen(false);
      reset();
      setSelectedMembers([]);
      setEditingId(null);
      await loadData();
    } catch (error) {
      setNotification({ message: "Could not save team.", type: 'error' });
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
          <p className="text-sm text-muted-foreground">Manage work groups and project leadership.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setSelectedMembers([]); setMemberSearch(""); reset(); setIsDialogOpen(true); }} className="shadow-md">
          <Plus className="mr-2 h-4 w-4" /> New Team
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="font-bold">Team Name</TableHead>
              <TableHead className="font-bold">Lead Coordinator</TableHead>
              <TableHead className="font-bold">Team Capacity</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
            ) : teams.map(t => (
              <TableRow key={t.id} className="hover:bg-slate-50/30 transition-colors group">
                <TableCell className="font-bold text-slate-800">{t.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <UsersIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      {users.find(u => u.id === t.leaderId)?.name || <span className="text-slate-400 italic font-normal">Unassigned</span>}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex items-center gap-2">
                     <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono">
                       {t.memberIds?.length || 0}
                     </Badge>
                     <span className="text-xs text-slate-400">active members</span>
                   </div>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end space-x-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(t)} disabled={deletingId === t.id} className="h-8 w-8 hover:bg-slate-100">
                          <Edit2 className="h-4 w-4 text-slate-600"/>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-red-50" 
                          onClick={() => deleteTeam(t.id)}
                          disabled={deletingId === t.id}
                        >
                          {deletingId === t.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                        </Button>
                    </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && teams.length === 0 && (
               <TableRow>
                 <TableCell colSpan={4} className="text-center py-16 text-muted-foreground bg-slate-50/30">
                    <div className="flex flex-col items-center gap-3">
                      <UsersIcon className="h-12 w-12 opacity-10" />
                      <p className="font-medium italic">No teams established. Start by creating your first group.</p>
                    </div>
                 </TableCell>
               </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60] animate-in fade-in duration-200" />
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl">{editingId ? "Team Configuration" : "Build New Team"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Team Identity</Label>
                <Input {...register('name', {required: true})} placeholder="e.g. System Ops" className="focus:ring-primary/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Lead Specialist</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none" {...register('leaderId', {required: true})}>
                    <option value="">Choose Leader...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email.split('@')[0]})</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Mission Statement</Label>
              <Input {...register('description')} placeholder="Primary objectives and focus areas..." />
            </div>

            <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Member Rostering</Label>
                  <Badge variant="outline" className="text-[10px] bg-slate-50">{selectedMembers.length} linked</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input 
                    type="text" 
                    placeholder="Find collaborators..." 
                    className="pl-9 mb-3 h-9 text-sm"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-52 overflow-y-auto border rounded-xl p-1 bg-slate-50/50 space-y-0.5 shadow-inner">
                    {filteredUsers.map(u => (
                        <div 
                          key={u.id} 
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${selectedMembers.includes(u.id) ? 'bg-white border-primary/20 shadow-sm' : 'hover:bg-white border-transparent'}`} 
                          onClick={() => toggleMember(u.id)}
                        >
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${selectedMembers.includes(u.id) ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold ${selectedMembers.includes(u.id) ? 'text-slate-900' : 'text-slate-700'}`}>{u.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{u.email}</span>
                              </div>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedMembers.includes(u.id) ? 'bg-primary border-primary' : 'border-slate-300 bg-white'}`}>
                              {selectedMembers.includes(u.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                            </div>
                        </div>
                    ))}
                    {filteredUsers.length === 0 && <p className="text-xs text-slate-400 text-center py-8 italic">No matching personnel found.</p>}
                </div>
            </div>

            <DialogFooter className="pt-6 mt-4 border-t border-slate-100 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={saving} className="text-slate-500">Discard Changes</Button>
              <Button type="submit" disabled={saving} className="px-8 shadow-md">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Syncing...</> : editingId ? "Update Team" : "Launch Team"}
              </Button>
            </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};
