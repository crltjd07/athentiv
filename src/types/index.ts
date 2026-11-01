// src/types/index.ts
export interface ProjectItem {
  id: number;
  title: string;
  description: string;
  status: 'active' | 'completed';
}