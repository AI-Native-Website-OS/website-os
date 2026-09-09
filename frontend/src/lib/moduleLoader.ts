import api from '@/lib/api';
import type { CoreModule } from '@/types';
import { resolveModule } from '@/lib/moduleConfig';

export async function loadCoreModules(): Promise<CoreModule[]> {
  try {
    const res: any = await api.get('/core-modules');
    return res.data || [];
  } catch {
    return [];
  }
}

export async function loadModule(moduleKey: string): Promise<CoreModule | null> {
  const modules = await loadCoreModules();
  return resolveModule(modules, moduleKey) || null;
}
