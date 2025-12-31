
import { supabase } from '../lib/supabase';
import { User, Team } from '../types';

const nullify = (val: any) => (val === '' ? null : val);

/**
 * Users Service: Handles user profile management and roles.
 */
export const usersApi = {
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data as User[];
  },

  async getProfile(uid: string): Promise<User | null> {
    // Explicitly check for valid uid to avoid unnecessary query attempts
    if (!uid) return null;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .maybeSingle(); 
    
    if (error) {
      console.warn("Supabase profile query details:", error);
      throw error;
    }
    return data as User | null;
  },

  async updateAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ isAdmin })
      .eq('id', userId);
    
    if (error) throw error;
  }
};

/**
 * Teams Service: Handles Team CRUD and relational member synchronization.
 */
export const teamsApi = {
  async getAll(): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('*, team_members(userId)')
      .order('name');

    if (error) throw error;

    return data.map((team: any) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      leaderId: team.leaderId,
      repositories: team.repositories || [],
      gitlabProjectId: team.gitlabProjectId,
      memberIds: team.team_members?.map((m: any) => m.userId) || []
    })) as Team[];
  },

  async save(team: Partial<Team>, memberIds: string[]): Promise<void> {
    const isNew = !team.id;
    
    const teamPayload = {
      name: team.name,
      description: team.description,
      leaderId: nullify(team.leaderId),
      repositories: team.repositories || [],
      gitlabProjectId: team.gitlabProjectId
    };

    let teamId = team.id;

    if (isNew) {
      const { data, error } = await supabase
        .from('teams')
        .insert(teamPayload)
        .select()
        .single();
      if (error) throw error;
      teamId = data.id;
    } else {
      const { error } = await supabase
        .from('teams')
        .update(teamPayload)
        .eq('id', teamId);
      if (error) throw error;
    }

    if (!isNew) {
      const { error: delError } = await supabase
        .from('team_members')
        .delete()
        .eq('teamId', teamId);
      if (delError) throw delError;
    }

    if (memberIds.length > 0) {
      const memberPayload = memberIds.map(uid => ({
        teamId: teamId,
        userId: uid
      }));
      const { error: insError } = await supabase
        .from('team_members')
        .insert(memberPayload);
      if (insError) throw insError;
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
