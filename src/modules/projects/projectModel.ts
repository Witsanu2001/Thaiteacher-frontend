export type ProjectAllocation = { id: string; category: string; budget: number; sourceLabel?: string };
export type ProjectActivity = { id: string; name: string; allocations: ProjectAllocation[] };
export type SchoolProject = {
  id: string;
  fiscalYear: number;
  name: string;
  department: string;
  owner: string;
  activities: ProjectActivity[];
  version?: string;
};

export const activityBudget = (activity: ProjectActivity) => activity.allocations.reduce((total, allocation) => total + allocation.budget, 0);
export const projectBudget = (project: SchoolProject) => project.activities.reduce((total, activity) => total + activityBudget(activity), 0);
export const projectExpenseId = (projectId: string, activityId: string) => `pexp_${projectId}_${activityId}_`;
export const newId = () => crypto.randomUUID().replaceAll("-", "");
