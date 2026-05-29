import { Channel, invoke } from '@tauri-apps/api/core'

export interface PdfExtractResult {
  text: string
  pages: number
  truncated: boolean
}

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
}

export interface StoredAnalysisRow {
  id: string
  paperId: string
  paperJson: string
  summary?: string
  score?: number
  flagsJson?: string
  fullText?: string
  analyzedAt: string
}

export interface StoredSessionRow {
  id: string
  title?: string
  createdAt: string
  updatedAt: string
}

export interface StoredMessageRow {
  id: string
  sessionId: string
  role: string
  content?: string
  toolCalls?: string
  toolResults?: string
  createdAt: string
}

export async function tauriReadText(path: string): Promise<string> {
  return invoke<string>('fs_read_text', { path })
}

export async function tauriListDir(path: string, recursive = false): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('fs_list_dir', { args: { path, recursive } })
}

export async function tauriExtractPdf(path: string): Promise<PdfExtractResult> {
  return invoke<PdfExtractResult>('pdf_extract_text', { path })
}

export async function tauriPickFile(filters?: string[]): Promise<string | null> {
  const res = await invoke<{ path: string | null }>('fs_pick_file', { filters: filters ?? null })
  return res.path
}

export async function tauriSaveAnalysis(args: {
  id: string
  paperId: string
  paperJson: string
  summary?: string
  score?: number
  flagsJson?: string
  fullText?: string
  analyzedAt: string
}): Promise<void> {
  await invoke('db_save_analysis', { args })
}

export async function tauriListAnalyses(limit = 100): Promise<StoredAnalysisRow[]> {
  return invoke<StoredAnalysisRow[]>('db_list_analyses', { limit })
}

export async function tauriCreateSession(id: string, title?: string): Promise<void> {
  await invoke('db_create_session', { args: { id, title: title ?? null } })
}

export async function tauriListSessions(limit = 50): Promise<StoredSessionRow[]> {
  return invoke<StoredSessionRow[]>('db_list_sessions', { limit })
}

export async function tauriSaveMessage(args: {
  id: string
  sessionId: string
  role: string
  content?: string
  toolCalls?: string
  toolResults?: string
}): Promise<void> {
  await invoke('db_save_message', { args })
}

export async function tauriListMessages(sessionId: string): Promise<StoredMessageRow[]> {
  return invoke<StoredMessageRow[]>('db_list_messages', { sessionId })
}

export async function tauriDeleteSession(sessionId: string): Promise<void> {
  await invoke('db_delete_session', { sessionId })
}

export interface StoredBookmarkRow {
  id: string
  paperId?: string
  paperJson: string
  note?: string
  createdAt: string
}

export async function tauriSaveBookmark(args: {
  id: string
  paperId?: string
  paperJson: string
  note?: string
}): Promise<void> {
  await invoke('db_save_bookmark', { args })
}

export async function tauriListBookmarks(limit = 100): Promise<StoredBookmarkRow[]> {
  return invoke<StoredBookmarkRow[]>('db_list_bookmarks', { limit })
}

export async function tauriDeleteBookmark(id: string): Promise<void> {
  await invoke('db_delete_bookmark', { id })
}

export interface AgentNodeStatus {
  available: boolean
  nodeAvailable?: boolean
  runtimeAvailable?: boolean
  bundled?: boolean
  running: boolean
  ready: boolean
  projectRoot: string
}

type AgentRunStreamEvent =
  | { event: 'chunk'; delta: string }
  | { event: 'done'; messages: unknown; finalAnswer: string }
  | { event: 'error'; message: string }

export async function tauriAgentNodeStatus(): Promise<AgentNodeStatus> {
  return invoke<AgentNodeStatus>('agent_node_status')
}

export async function tauriSearchMemory(args: {
  query: string
  sessionId?: string
  limit?: number
}): Promise<
  Array<{
    sessionId: string
    sessionTitle?: string
    role: string
    content: string
    createdAt: string
  }>
> {
  return invoke('db_search_memory', { args })
}

export async function tauriAgentRun(options: {
  userInput: string
  history: Array<{ role: string; content: string }>
  sessionId?: string
  onChunk?: (delta: string) => void
}): Promise<{ messages: unknown; finalAnswer: string }> {
  return new Promise((resolve, reject) => {
    const channel = new Channel<AgentRunStreamEvent>()
    channel.onmessage = (event) => {
      if (event.event === 'chunk') {
        options.onChunk?.(event.delta)
      } else if (event.event === 'done') {
        resolve({ messages: event.messages, finalAnswer: event.finalAnswer })
      } else if (event.event === 'error') {
        reject(new Error(event.message))
      }
    }
    invoke('agent_run', {
      request: {
        userInput: options.userInput,
        history: options.history,
        sessionId: options.sessionId ?? null,
      },
      onEvent: channel,
    }).catch(reject)
  })
}

export interface PersonInvestigationReportPayload {
  subject: { name: string; university?: string; nameVariants: string[] }
  experts: unknown[]
  authors: unknown[]
  papers: unknown[]
  webFindings: unknown[]
  paperAnalyses: unknown[]
  referenceChecks: unknown[]
  opensourceChecks: unknown[]
  summary: string
  overallScore: number
  flags: Array<{ type: string; severity: string; description: string; evidence: string }>
  investigatedAt: string
}

export type PersonInvestigationPartialPayload = Partial<
  Pick<
    PersonInvestigationReportPayload,
    | 'subject'
    | 'experts'
    | 'authors'
    | 'papers'
    | 'webFindings'
    | 'paperAnalyses'
    | 'referenceChecks'
    | 'opensourceChecks'
  >
>

type AgentInvestigateStreamEvent =
  | { event: 'step'; stepId: string; label: string; status: string; detail?: string }
  | { event: 'partial'; patch: PersonInvestigationPartialPayload }
  | { event: 'done'; report: PersonInvestigationReportPayload }
  | { event: 'error'; message: string }

export async function tauriInvestigatePerson(options: {
  name: string
  university?: string
  maxPapers?: number
  onStep?: (step: { stepId: string; label: string; status: string; detail?: string }) => void
  onPartial?: (patch: PersonInvestigationPartialPayload) => void
}): Promise<PersonInvestigationReportPayload> {
  return new Promise((resolve, reject) => {
    const channel = new Channel<AgentInvestigateStreamEvent>()
    channel.onmessage = (event) => {
      if (event.event === 'step') {
        options.onStep?.({
          stepId: event.stepId,
          label: event.label,
          status: event.status,
          detail: event.detail,
        })
      } else if (event.event === 'partial') {
        options.onPartial?.(event.patch)
      } else if (event.event === 'done') {
        resolve(event.report)
      } else if (event.event === 'error') {
        reject(new Error(event.message))
      }
    }
    invoke('agent_investigate', {
      request: {
        name: options.name,
        university: options.university ?? null,
        maxPapers: options.maxPapers ?? null,
      },
      onEvent: channel,
    }).catch(reject)
  })
}

export async function tauriCancelInvestigate(): Promise<void> {
  await invoke('agent_investigate_cancel')
}
