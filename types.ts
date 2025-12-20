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

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

export interface Task {
  id: string;
  title: string;
  description: string; // Markdown
  status: 'To Do' | 'In Progress' | 'Testing' | 'Review' | 'Done';
  
  // Relationships
  userStoryId: string;
  backlogId: string;
  teamId?: string;
  assigneeId?: string;
  milestoneId?: string;

  // Attributes
  stack: 'Frontend' | 'Backend';
  panel: 'Admin' | 'Customer'; // Inherited from Story
  
  // Tracking
  createdAt: number;
  startTime?: number; // First transition to In Progress
  endTime?: number; // Transition to Done
  
  history?: TaskHistory[];
  comments?: TaskComment[];
  
  // Audit
  createdBy?: { userId: string; userName: string; };
  lastEditedBy?: { userId: string; userName: string; timestamp: number; };
}