
import { Task, UserStory, Milestone } from '../types';

export const calculateDoraMetrics = (tasks: Task[], stories: UserStory[], milestones: Milestone[]) => {
  const now = Date.now();
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
  
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeStories = Array.isArray(stories) ? stories : [];
  const safeMilestones = Array.isArray(milestones) ? milestones : [];

  const doneTasks = safeTasks.filter(t => t.status === 'Done');
  const recentDoneTasks = doneTasks.filter(t => t.endTime && t.endTime > oneWeekAgo);

  // 1. Throughput
  const throughput = recentDoneTasks.length;

  // 2. Mean Lead Time
  const leadTimes = doneTasks.filter(t => t.endTime).map(t => t.endTime! - t.createdAt);
  const avgLeadTime = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0;

  // 3. Cycle Time
  const cycleTimes = doneTasks.filter(t => t.startTime && t.endTime).map(t => t.endTime! - t.startTime!);
  const avgCycleTime = cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0;

  // 4. Flow Efficiency
  const flowEfficiency = avgLeadTime > 0 ? (avgCycleTime / avgLeadTime) * 100 : 0;

  // 5. Predictability Score
  const storyPerformances = safeStories
    .map(s => {
      const storyTasks = doneTasks.filter(t => t.userStoryId === s.id);
      if (storyTasks.length === 0 || !s.points) return null;
      const totalCycle = storyTasks.reduce((sum, t) => sum + ((t.endTime || 0) - (t.startTime || t.createdAt)), 0);
      return totalCycle / Math.max(1, s.points); 
    })
    .filter((v): v is number => v !== null);

  let predictabilityScore = 0;
  if (storyPerformances.length > 1) {
    const mean = storyPerformances.reduce((a, b) => a + b, 0) / storyPerformances.length;
    const variance = storyPerformances.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / storyPerformances.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? stdDev / mean : 0;
    predictabilityScore = Math.max(0, Math.min(100, 100 - (cv * 50)));
  } else if (storyPerformances.length === 1) {
    predictabilityScore = 100;
  }

  // 6. Velocity
  const doneStoryIds = new Set(doneTasks.map(t => t.userStoryId));
  const completedPoints = safeStories
    .filter(s => doneStoryIds.has(s.id))
    .reduce((sum, s) => sum + (Number(s.points) || 0), 0);
  
  // 7. Forecasting
  const activeMilestone = safeMilestones.find(m => m.status === 'Active');
  let forecast = null;
  if (activeMilestone) {
    const mStories = safeStories.filter(s => activeMilestone.userStoryIds?.includes(s.id));
    const totalPoints = mStories.reduce((sum, s) => sum + (Number(s.points) || 0), 0);
    const mTasks = safeTasks.filter(t => t.milestoneId === activeMilestone.id);
    const doneMTasks = mTasks.filter(t => t.status === 'Done');
    const mPointsDone = mStories
        .filter(s => doneMTasks.some(dt => dt.userStoryId === s.id))
        .reduce((sum, s) => sum + (Number(s.points) || 0), 0);
    const remainingPoints = Math.max(0, totalPoints - mPointsDone);
    const weeksSinceStart = Math.max(0.1, (now - new Date(activeMilestone.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const velocityPerWeek = mPointsDone / weeksSinceStart;
    
    forecast = {
        remainingPoints,
        estimatedWeeks: velocityPerWeek > 0 ? (remainingPoints / velocityPerWeek).toFixed(1) : '∞',
        status: velocityPerWeek > 0 && (remainingPoints / velocityPerWeek) < 4 ? 'On Track' : 'At Risk'
    };
  }

  return {
    throughput,
    avgLeadTime,
    avgCycleTime,
    flowEfficiency,
    predictabilityScore,
    completedPoints,
    forecast,
    radarMetrics: {
        speed: Math.min(100, (throughput / 10) * 100),
        predictability: predictabilityScore,
        quality: safeTasks.length > 0 ? (doneTasks.length / safeTasks.length) * 100 : 0,
        collaboration: safeTasks.some(t => t.comments && t.comments.length > 0) ? 85 : 30,
        stability: 100 - (safeTasks.filter(t => t.history?.some(h => h.status === 'Testing')).length / (safeTasks.length || 1)) * 20
    }
  };
};

export const formatMs = (ms: number) => {
  if (!ms || ms <= 0) return "0h";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};
