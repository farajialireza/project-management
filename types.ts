export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  leaderId: string;
  memberIds: string[];
  repositories: string[];
}

export interface ProductBacklog {
  id: string;
  title: string;
  description: string;
  createdAt: number;
}

export interface UserStory {
  id: string;
  backlogId: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  points: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'Planned' | 'Active' | 'Completed';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'Done';
  teamId: string;
  assigneeId?: string;
  milestoneId?: string;
  userStoryId?: string;
  createdAt: number;
}
