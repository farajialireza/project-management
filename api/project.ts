
import { supabase } from '../lib/supabase';
import { ProductBacklog, UserStory, Task, Milestone } from '../types';

const nullify = (val: any) => (val === '' ? null : val);

/**
 * Backlogs API: Manages the high-level project buckets.
 */
export const backlogsApi = {
  async getAll(): Promise<ProductBacklog[]> {
    const { data, error } = await supabase
      .from('product_backlogs')
      .select('*')
      .order('displayId', { ascending: true })
      .order('title', { ascending: true });

    if (error) throw error;
    return data as ProductBacklog[];
  },

  async save(backlog: Partial<ProductBacklog>): Promise<ProductBacklog> {
    const isNew = !backlog.id;
    const payload = {
      title: backlog.title,
      description: backlog.description,
      displayId: backlog.displayId,
      role: backlog.role,
      priority: backlog.priority,
      panel: backlog.panel,
      createdAt: backlog.createdAt || Date.now()
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('product_backlogs')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as ProductBacklog;
    } else {
      const { data, error } = await supabase
        .from('product_backlogs')
        .update(payload)
        .eq('id', backlog.id)
        .select()
        .single();
      if (error) throw error;
      return data as ProductBacklog;
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('product_backlogs')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

/**
 * User Stories API: Handles specific requirements linked to backlogs.
 */
export const storiesApi = {
  async getAll(): Promise<(UserStory & { backlogTitle?: string })[]> {
    const { data, error } = await supabase
      .from('user_stories')
      .select('*, product_backlogs(title)')
      .order('displayId', { ascending: true });

    if (error) throw error;
    
    return data.map((s: any) => ({
      ...s,
      backlogTitle: s.product_backlogs?.title
    })) as (UserStory & { backlogTitle: string })[];
  },

  async save(story: Partial<UserStory>): Promise<UserStory> {
    const isNew = !story.id;
    const payload = {
      backlogId: story.backlogId,
      milestoneId: nullify(story.milestoneId),
      title: story.title,
      description: story.description,
      priority: story.priority,
      points: story.points,
      role: story.role,
      displayId: story.displayId,
      panel: story.panel,
      createdAt: story.createdAt || Date.now()
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('user_stories')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as UserStory;
    } else {
      const { data, error } = await supabase
        .from('user_stories')
        .update(payload)
        .eq('id', story.id)
        .select()
        .single();
      if (error) throw error;
      return data as UserStory;
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_stories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

/**
 * Tasks API: The granular work items displayed on the Project Board.
 */
export const tasksApi = {
  async getAll(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data as Task[];
  },

  async getByStoryId(storyId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('userStoryId', storyId);
    
    if (error) throw error;
    return data as Task[];
  },

  async save(task: Partial<Task>): Promise<Task> {
    const isNew = !task.id;
    const { id, ...rest } = task;
    
    const payload = {
      ...rest,
      teamId: nullify(rest.teamId),
      assigneeId: nullify(rest.assigneeId),
      milestoneId: nullify(rest.milestoneId),
      userStoryId: nullify(rest.userStoryId),
      backlogId: nullify(rest.backlogId)
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...payload, createdAt: payload.createdAt || Date.now() })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    }
  },

  async updateStatus(id: string, updates: Partial<Task>): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async bulkSave(tasks: Partial<Task>[]): Promise<void> {
    const cleanedTasks = tasks.map(t => ({
      ...t,
      teamId: nullify(t.teamId),
      assigneeId: nullify(t.assigneeId),
      milestoneId: nullify(t.milestoneId),
      createdAt: t.createdAt || Date.now()
    }));
    const { error } = await supabase
      .from('tasks')
      .insert(cleanedTasks);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

/**
 * Milestones API: High-level roadmap tracking.
 */
export const milestonesApi = {
  async getAll(): Promise<Milestone[]> {
    const { data, error } = await supabase
      .from('milestones')
      .select('*, user_stories(id)')
      .order('endDate', { ascending: true });

    if (error) throw error;

    return data.map((m: any) => ({
      ...m,
      userStoryIds: m.user_stories?.map((s: any) => s.id) || []
    })) as Milestone[];
  },

  async save(milestone: Partial<Milestone>, storyIds: string[]): Promise<void> {
    const isNew = !milestone.id;
    const payload = {
      title: milestone.title,
      description: milestone.description,
      startDate: milestone.startDate,
      endDate: milestone.endDate,
      status: milestone.status
    };

    let mid = milestone.id;

    if (isNew) {
      const { data, error } = await supabase
        .from('milestones')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      mid = data.id;
    } else {
      const { error } = await supabase
        .from('milestones')
        .update(payload)
        .eq('id', mid);
      if (error) throw error;
    }

    await supabase.from('user_stories').update({ milestoneId: null }).eq('milestoneId', mid);
    
    if (storyIds.length > 0) {
      const { error: linkError } = await supabase
        .from('user_stories')
        .update({ milestoneId: mid })
        .in('id', storyIds);
      if (linkError) throw linkError;
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
