import type { ProjectDraft } from '../types/index.ts';

export const PROJECT_DRAFT_EVENT = 'talentbridge:project-draft';
export const PROJECT_DRAFT_LIMITS = { title: 100, text: 2000, short: 100, tools: 20 };

export function sanitizeProjectDraft(value: unknown): ProjectDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const draft: ProjectDraft = {};
  for (const field of ['title', 'description', 'scope', 'deliverables', 'evaluationCriteria', 'projectField'] as const) {
    const text = source[field];
    if (typeof text === 'string' && text.trim()) {
      draft[field] = text.trim().slice(0, field === 'title' ? PROJECT_DRAFT_LIMITS.title
        : field === 'projectField' ? PROJECT_DRAFT_LIMITS.short : PROJECT_DRAFT_LIMITS.text);
    }
  }
  if (Array.isArray(source.tools)) {
    draft.tools = [...new Set(source.tools.filter((tool): tool is string => typeof tool === 'string' && !!tool.trim())
      .map(tool => tool.trim().slice(0, PROJECT_DRAFT_LIMITS.short)))].slice(0, PROJECT_DRAFT_LIMITS.tools);
    if (!draft.tools.length) delete draft.tools;
  }
  return draft;
}
