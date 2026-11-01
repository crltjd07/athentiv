import { NextResponse } from 'next/server';
import { ProjectItem } from '@/types';

export async function GET() {
  const data: ProjectItem[] = [
    { id: 1, title: 'TypeScript Setup', description: 'Configure project options', status: 'completed' },
    { id: 2, title: 'Cloud Deployment', description: 'Deploy site to Vercel', status: 'active' },
  ];

  return NextResponse.json({ success: true, payload: data });
}