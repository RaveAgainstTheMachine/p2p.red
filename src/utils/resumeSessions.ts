export const RELAY_SIZE_LIMIT_BYTES = 100 * 1024 * 1024 * 1024;
export const RESUME_SESSION_KEY = 'p2p_resume_sessions_v1';

export interface ResumeSession {
  transferId: string;
  role: 'sender' | 'receiver';
  fileName: string;
  fileSize: number;
  lastModified?: number;
  shardSize: number;
  shardCount: number;
  completedShardIds: number[];
  updatedAt: number;
  status: 'in_progress' | 'complete';
}

export const loadResumeSessionMap = (): Record<string, ResumeSession> => {
  try {
    const raw = localStorage.getItem(RESUME_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ResumeSession>;
  } catch {
    return {};
  }
};

export const saveResumeSessionMap = (sessions: Record<string, ResumeSession>) => {
  try {
    localStorage.setItem(RESUME_SESSION_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
};

export const removeResumeSession = (transferId: string) => {
  const sessions = loadResumeSessionMap();
  if (!sessions[transferId]) return;
  delete sessions[transferId];
  saveResumeSessionMap(sessions);
};

export const normalizeResumeSessions = (sessions: Record<string, ResumeSession>) => {
  return Object.values(sessions)
    .filter((session) => session.status === 'in_progress')
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

