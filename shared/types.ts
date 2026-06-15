export type TaskCategory =
  | "content"
  | "distribute"
  | "playlist"
  | "engage"
  | "setup"
  | "admin";

export type PhaseColor =
  | "blue"
  | "purple"
  | "yellow"
  | "green"
  | "orange"
  | "gray";

export interface TaskTemplate {
  day: string;
  category: TaskCategory;
  task: string;
}

export interface WeekTemplate {
  label: string;
  subtitle: string;
  tasks: TaskTemplate[];
}

export interface PhaseTemplate {
  title: string;
  color: PhaseColor;
  weeks: WeekTemplate[];
}

export interface ProjectTemplate {
  slug: string;
  name: string;
  tagline: string;
  bookingUrl: string;
  funnelNote: string;
  phases: PhaseTemplate[];
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  bookingUrl: string;
  funnelNote: string;
  createdAt: string;
  updatedAt: string;
  totalTasks: number;
  completedTasks: number;
}

export interface Task {
  id: string;
  day: string;
  category: TaskCategory;
  task: string;
  completed: boolean;
  sortOrder: number;
}

export interface Week {
  id: string;
  label: string;
  subtitle: string;
  sortOrder: number;
  tasks: Task[];
}

export interface Phase {
  id: string;
  title: string;
  color: PhaseColor;
  sortOrder: number;
  weeks: Week[];
}

export interface ProjectDetail extends ProjectSummary {
  phases: Phase[];
}

export interface CreateProjectInput {
  name: string;
  slug?: string;
  tagline?: string;
  bookingUrl?: string;
  funnelNote?: string;
  templateSlug?: string;
}

export interface UpdateProjectInput {
  name?: string;
  tagline?: string;
  bookingUrl?: string;
  funnelNote?: string;
}

export interface UpdateTaskInput {
  completed?: boolean;
  day?: string;
  category?: TaskCategory;
  task?: string;
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  content: "Content",
  distribute: "Distribution",
  playlist: "Playlisting",
  engage: "Community",
  setup: "Setup",
  admin: "Admin",
};

export const PHASE_COLORS: Record<PhaseColor, string> = {
  blue: "#185FA5",
  purple: "#534AB7",
  yellow: "#BA7517",
  green: "#0F6E56",
  orange: "#D85A30",
  gray: "#5F5E5A",
};

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  content: "#534AB7",
  distribute: "#185FA5",
  playlist: "#0F6E56",
  engage: "#D85A30",
  setup: "#B8448B",
  admin: "#5F5E5A",
};
