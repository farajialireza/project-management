
export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  gitlabToken?: string;
  gitlabUserId?: string; // New: For mapping CLI/CI events to the user
}

export interface Team {
  id: string;
  name: string;
  description: string;
  leaderId: string;
  memberIds: string[];
  repositories: string[]; // Supports multiple repo names
  gitlabProjectId?: string;
}

export interface ProductBacklog {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  displayId?: string;
  role?: string;
  priority?: 'Low' | 'Medium' | 'High';
  panel?: 'Admin' | 'Customer';
}

export interface UserStory {
  id: string;
  backlogId: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  points: number;
  role?: string;
  displayId?: string;
  panel?: 'Admin' | 'Customer';
  createdAt?: number;
  milestoneId?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'Planned' | 'Active' | 'Completed';
  userStoryIds?: string[];
}

export interface TaskHistory {
  status: string;
  timestamp: number;
  userId: string;
  userName: string;
}

export interface AssignmentHistory {
  type: 'Team' | 'Member';
  assignedToId: string;
  assignedToName: string;
  assignedById: string;
  assignedByName: string;
  timestamp: number;
}

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

export interface SubTask {
  id: string;
  title: string;
  isDone: boolean;
}

export interface LinkedCommit {
  hash: string;
  title: string;
  author: string;
  date: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'Testing' | 'Review' | 'Done';
  userStoryId: string;
  backlogId: string;
  teamId?: string;
  assigneeId?: string;
  milestoneId?: string;
  stack: 'Frontend' | 'Backend';
  panel: 'Admin' | 'Customer'; 
  createdAt: number;
  startTime?: number; 
  endTime?: number; 
  history?: TaskHistory[];
  assignmentHistory?: AssignmentHistory[];
  comments?: TaskComment[];
  subtasks?: SubTask[];
  linkedCommits?: LinkedCommit[];
  createdBy?: { userId: string; userName: string; };
  lastEditedBy?: { userId: string; userName: string; timestamp: number; };
}
