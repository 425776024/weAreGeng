import type { AgentMessage, AgentRunResult } from '@wearegeng/agent/agents/types'
import {
  tauriAgentNodeStatus,
  tauriAgentRun,
  type AgentNodeStatus,
} from '../api/tauri-backend'

export type { AgentMessage, AgentRunResult, AgentNodeStatus }

export async function getAgentNodeStatus(): Promise<AgentNodeStatus> {
  return tauriAgentNodeStatus()
}

export async function runAcademicAgent(
  userInput: string,
  history: AgentMessage[] = [],
  options?: { onStream?: (delta: string) => void; sessionId?: string },
): Promise<AgentRunResult> {
  const status = await getAgentNodeStatus()
  if (!status.available) {
    const hint = status.bundled
      ? '内置 Node Agent 启动失败，请重启应用或查看终端日志。'
      : 'Node Agent 不可用，请运行：npm run setup:node && npm run build:tauri-agent'
    throw new Error(hint)
  }

  const result = await tauriAgentRun({
    userInput,
    sessionId: options?.sessionId,
    history: history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content })),
    onChunk: options?.onStream,
  })

  return {
    messages: (result.messages as AgentMessage[]) ?? history,
    finalAnswer: result.finalAnswer,
  }
}
