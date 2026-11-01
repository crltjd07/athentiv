import { ProjectItem } from '@/types';

async function fetchProjects(): Promise<ProjectItem[]> {
  // Demo static data (or perform fetch/DB queries)
  return [
    { id: 1, title: 'TypeScript Web App', description: 'Fully type-safe Next.js setup.', status: 'completed' },
    { id: 2, title: 'Production Deployment', description: 'Live on Vercel infrastructure.', status: 'active' }
  ];
}

export default async function HomePage() {
  const projects = await fetchProjects();

  return (
    <main className="min-h-screen p-8 bg-slate-900 text-slate-100">
      <h1 className="text-3xl font-bold mb-6">TypeScript Deployment Pipeline</h1>
      <div className="grid gap-4">
        {projects.map((project) => (
          <div key={project.id} className="p-4 rounded-lg bg-slate-800 border border-slate-700">
            <h2 className="text-xl font-semibold">{project.title}</h2>
            <p className="text-slate-400 mt-1">{project.description}</p>
            <span className={`inline-block mt-3 px-2 py-1 text-xs rounded ${
              project.status === 'completed' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-amber-900/50 text-amber-400'
            }`}>
              {project.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}