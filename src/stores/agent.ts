import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getAgentNodeStatus,
  runAcademicAgent,
  type AgentMessage,
  type AgentNodeStatus,
} from '../services/academic-agent'
import {
  tauriCreateSession,
  tauriDeleteSession,
  tauriListMessages,
  tauriListSessions,
  tauriSaveMessage,
  type StoredSessionRow,
} from '../api/tauri-backend'

function newSessionId() {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function newMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseToolName(toolCalls?: string): string | undefined {
  if (!toolCalls) return undefined
  try {
    const parsed = JSON.parse(toolCalls) as { name?: string }
    return parsed.name
  } catch {
    return undefined
  }
}

function serializeMessageExtras(msg: AgentMessage) {
  if (msg.role === 'tool' && msg.name) {
    return {
      toolCalls: JSON.stringify({ name: msg.name }),
      toolResults: msg.content.slice(0, 8000),
    }
  }
  if (msg.toolCalls || msg.toolResults) {
    return { toolCalls: msg.toolCalls, toolResults: msg.toolResults }
  }
  return undefined
}

export const useAgentStore = defineStore('agent', () => {
  const messages = ref<AgentMessage[]>([])
  const sessions = ref<StoredSessionRow[]>([])
  const sessionId = ref<string | null>(null)
  const loading = ref(false)
  const streamingText = ref('')
  const error = ref('')
  const nodeStatus = ref<AgentNodeStatus | null>(null)

  async function refreshNodeStatus() {
    nodeStatus.value = await getAgentNodeStatus()
  }

  async function ensureSession(title?: string) {
    if (!sessionId.value) {
      sessionId.value = newSessionId()
      await tauriCreateSession(sessionId.value, title ?? '新对话')
    }
  }

  async function persistMessage(msg: AgentMessage) {
    if (!sessionId.value) return
    const extra = serializeMessageExtras(msg)
    await tauriSaveMessage({
      id: newMessageId(),
      sessionId: sessionId.value,
      role: msg.role,
      content: msg.content,
      toolCalls: extra?.toolCalls,
      toolResults: extra?.toolResults,
    })
  }

  async function persistNewMessages(beforeLen: number, trace: AgentMessage[]) {
    const newMessages = trace.slice(beforeLen + 1)
    for (const msg of newMessages) {
      await persistMessage(msg)
    }
  }

  async function loadSessions() {
    sessions.value = await tauriListSessions()
  }

  async function loadSession(id: string) {
    sessionId.value = id
    const rows = await tauriListMessages(id)
    messages.value = rows.map((r) => ({
      role: r.role as AgentMessage['role'],
      content: r.content ?? '',
      name: r.role === 'tool' ? parseToolName(r.toolCalls) ?? 'tool' : undefined,
      toolCallId: undefined,
      toolCalls: r.toolCalls,
      toolResults: r.toolResults,
    }))
  }

  async function send(userInput: string) {
    if (!userInput.trim()) return
    loading.value = true
    error.value = ''
    streamingText.value = ''
    const input = userInput.trim()
    try {
      await ensureSession(input.slice(0, 40))
      const historyLen = messages.value.length
      const history = messages.value.filter((m) => m.role === 'user' || m.role === 'assistant')
      await persistMessage({ role: 'user', content: input })

      const result = await runAcademicAgent(input, history, {
        onStream: (delta) => {
          streamingText.value += delta
        },
        sessionId: sessionId.value ?? undefined,
      })
      messages.value = result.messages
      streamingText.value = ''

      await persistNewMessages(historyLen, result.messages)
      await loadSessions()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function clear() {
    messages.value = []
    error.value = ''
    sessionId.value = null
  }

  async function removeSession(id: string) {
    await tauriDeleteSession(id)
    if (sessionId.value === id) {
      messages.value = []
      sessionId.value = null
    }
    await loadSessions()
  }

  return {
    messages,
    sessions,
    sessionId,
    loading,
    streamingText,
    error,
    nodeStatus,
    send,
    clear,
    loadSession,
    removeSession,
    loadSessions,
    refreshNodeStatus,
  }
})
