import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Dialog, DialogHeader, DialogTitle, Input, Label, DialogFooter, Card, Switch, Badge } from '../ui';
import { Team, User } from '../../types';
import { Plus, Trash2, Edit2, Users as UsersIcon, Search } from 'lucide-react';

// --- Users View ---
export const UsersView = () => {
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleAdmin = async (u: User) => {
    if (u.email === 'realovatsug@gmail.com') return; // Cannot demote super admin
    const newStatus = !u.isAdmin;
    await updateDoc(doc(db, "users", u.id), { isAdmin: newStatus });
    setUsers(users.map(user => user.id === u.id ? { ...user, isAdmin: newStatus } : user));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Admin Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Switch checked={u.isAdmin} onCheckedChange={() => toggleAdmin(u)} />
                    <span className="text-sm text-muted-foreground">{u.isAdmin ? 'Admin' : 'User'}</span>
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

// --- Teams View ---
export const TeamsView = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  
  // Form State
  const { register, handleSubmit, reset, setValue, watch } = useForm<Team & { memberIds: string[] }>();
  // Custom multi-select state
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  const fetchTeams = async () => {
    const snap = await getDocs(collection(db, "teams"));
    setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
  };
  
  const fetchUsers = async () => {
     const snap = await getDocs(collection(db, "users"));
     setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
  };

  useEffect(() => { fetchTeams(); fetchUsers(); }, []);

  const onEdit = (t: Team) => {
    setEditingId(t.id);
    setValue("name", t.name);
    setValue("description", t.description);
    setValue("leaderId", t.leaderId);
    setValue("repositories", t.repositories || []);
    setSelectedMembers(t.memberIds || []);
    setMemberSearch("");
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: any) => {
    const payload = { ...data, memberIds: selectedMembers };
    if (editingId) {
      await updateDoc(doc(db, "teams", editingId), payload);
    } else {
      await addDoc(collection(db, "teams"), payload);
    }
    setIsDialogOpen(false);
    reset();
    setSelectedMembers([]);
    setMemberSearch("");
    setEditingId(null);
    fetchTeams();
  };

  const deleteTeam = async (id: string) => {
    if(confirm('Delete team?')) {
        await deleteDoc(doc(db, "teams", id));
        fetchTeams();
    }
  }

  const toggleMember = (uid: string) => {
      if (selectedMembers.includes(uid)) {
          setSelectedMembers(selectedMembers.filter(id => id !== uid));
      } else {
          setSelectedMembers([...selectedMembers, uid]);
      }
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
        <Button onClick={() => { setEditingId(null); setSelectedMembers([]); setMemberSearch(""); reset(); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Create Team
        </Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{users.find(u => u.id === t.leaderId)?.name || 'Unknown'}</TableCell>
                <TableCell>{t.memberIds?.length || 0} members</TableCell>
                <TableCell>
                    <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(t)}><Edit2 className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteTeam(t.id)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader><DialogTitle>{editingId ? "Edit" : "Create"} Team</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2"><Label>Team Name</Label><Input {...register('name', {required: true})} /></div>
            <div className="space-y-2"><Label>Description</Label><Input {...register('description')} /></div>
            
            <div className="space-y-2">
                <Label>Leader</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('leaderId', {required: true})}>
                    <option value="">Select Leader</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            </div>

            <div className="space-y-2">
                <Label>Members</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input 
                    type="text" 
                    placeholder="Search users..." 
                    className="pl-10 mb-2"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                    {filteredUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No users found</p>}
                    {filteredUsers.map(u => (
                        <div key={u.id} className="flex items-center space-x-2 hover:bg-muted/50 p-1 rounded cursor-pointer" onClick={() => toggleMember(u.id)}>
                            <input 
                                type="checkbox" 
                                className="h-4 w-4 rounded border-gray-300 pointer-events-none"
                                checked={selectedMembers.includes(u.id)}
                                readOnly
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{u.name}</span>
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="text-xs text-muted-foreground pt-1 flex justify-between">
                  <span>{selectedMembers.length} users selected</span>
                  {selectedMembers.length > 0 && (
                    <button type="button" onClick={() => setSelectedMembers([])} className="text-primary hover:underline">Clear</button>
                  )}
                </div>
            </div>

            <DialogFooter><Button type="submit">Save Team</Button></DialogFooter>
        </form>
      </Dialog>
    </div>
  );
};