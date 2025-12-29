
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { Button } from './ui';
import { LogOut, Layout, Book, Milestone, CheckSquare, Users, Settings, Bot, BarChart3 } from 'lucide-react';
import { BacklogsView, StoriesView, MilestonesView, TasksView } from './features/ProjectViews';
import { TeamsView, UsersView } from './features/AdminViews';
import { AiAssistantView } from './features/AiAssistantView';
import { AnalyticsView } from './features/AnalyticsView';

const TABS = [
  { id: 'backlogs', label: 'Backlogs', icon: Book, component: BacklogsView, adminOnly: true },
  { id: 'stories', label: 'User Stories', icon: Layout, component: StoriesView },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, component: TasksView },
  { id: 'milestones', label: 'Milestones', icon: Milestone, component: MilestonesView },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, component: AnalyticsView, adminOnly: true },
  { id: 'teams', label: 'Teams', icon: Users, component: TeamsView, adminOnly: true },
  { id: 'users', label: 'Users', icon: Settings, component: UsersView, adminOnly: true },
  { id: 'ai-assistant', label: 'AI Assistant', icon: Bot, component: AiAssistantView, adminOnly: true },
];

export const Dashboard = () => {
  const { user } = useAuth();
  // مقداردهی اولیه تب بر اساس نقش کاربر، فقط یکبار در هنگام Mount
  const [activeTab, setActiveTab] = useState(() => user?.isAdmin ? 'backlogs' : 'stories');

  const handleLogout = () => supabase.auth.signOut();

  // پیدا کردن کامپوننت فعال با اطمینان از دسترسی کاربر
  const currentTab = TABS.find(t => t.id === activeTab);
  const canAccess = !currentTab?.adminOnly || user?.isAdmin;
  
  const ActiveComponent = (canAccess && currentTab?.component) || StoriesView;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <Layout className="h-6 w-6" /> Product Canvas
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline-block">Welcome, {user?.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-6 px-4">
        {/* Mobile Tab Select */}
        <div className="md:hidden mb-6">
           <select 
            className="w-full h-10 rounded-md border border-input px-3"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
           >
             {TABS.filter(t => !t.adminOnly || user?.isAdmin).map(tab => (
               <option key={tab.id} value={tab.id}>{tab.label}</option>
             ))}
           </select>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden md:flex space-x-1 rounded-lg bg-muted p-1 mb-8 w-fit overflow-x-auto max-w-full">
          {TABS.filter(t => !t.adminOnly || user?.isAdmin).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                ${activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/50'}
              `}
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in zoom-in-95 duration-200">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
};
