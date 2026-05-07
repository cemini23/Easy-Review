import templatesJson from '@/data/templates.json';
import type { Category, CategoryDef, TemplatesJson } from '@/lib/types';

const data = templatesJson as unknown as TemplatesJson;

export function listCategories(): CategoryDef[] {
  return data.categories;
}

export function getTemplate(id: Category): CategoryDef {
  const cat = data.categories.find((c) => c.id === id);
  if (!cat) {
    throw new Error(`Unknown category: ${id}`);
  }
  return cat;
}

export function getTemplatesVersion(): string {
  return data.version;
}
