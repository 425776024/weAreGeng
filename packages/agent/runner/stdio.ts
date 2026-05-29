#!/usr/bin/env node
/**
 * Tauri Node 子进程 — Mastra Agent stdio worker
 *
 * 协议：每行一条 JSON（见 protocol.ts）
 */
import * as readline from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'
import type { AgentMessage } from '../agents/types'
import { runWorkerAgent } from './handle-run'
import { runWorkerInvestigate } from './handle-investigate'
import {
  encodeLine,
  type WorkerInbound,
  type WorkerInitPayload,
  type WorkerOutbound,
} from './protocol'
import { resolveDataDir } from './build-node-deps'

let initPayload: WorkerInitPayload | null = null
const proxyWaiters = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (err: Error) => void }
>()

function send(message: WorkerOutbound) {
  output.write(encodeLine(message))
}

function proxyTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
  const requestId = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return new Promise((resolve, reject) => {
    proxyWaiters.set(requestId, { resolve, reject })
    send({ type: 'proxy', requestId, tool, args })
    setTimeout(() => {
      if (proxyWaiters.has(requestId)) {
        proxyWaiters.delete(requestId)
        reject(new Error(`Tool proxy 超时: ${tool}`))
      }
    }, 120_000)
  })
}

async function handleRun(
  id: string,
  userInput: string,
  history: AgentMessage[],
  sessionId?: string,
) {
  if (!initPayload) {
    send({ type: 'error', id, message: 'Worker 未初始化' })
    return
  }
  try {
    const result = await runWorkerAgent({
      init: initPayload,
      userInput,
      history,
      sessionId,
      proxyTool,
      onStream: (delta) => send({ type: 'chunk', id, delta }),
    })
    send({ type: 'done', id, result })
  } catch (err) {
    send({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

async function handleInvestigate(
  id: string,
  name: string,
  university?: string,
  maxPapers?: number,
) {
  if (!initPayload) {
    send({ type: 'error', id, message: 'Worker 未初始化' })
    return
  }
  try {
    const report = await runWorkerInvestigate({
      init: initPayload,
      name,
      university,
      maxPapers,
      proxyTool,
      onStep: (step) =>
        send({
          type: 'investigate_step',
          id,
          stepId: step.id,
          label: step.label,
          status: step.status,
          detail: step.detail,
        }),
      onPartial: (patch) =>
        send({
          type: 'investigate_partial',
          id,
          patch: patch as Record<string, unknown>,
        }),
    })
    send({ type: 'investigate_done', id, report })
  } catch (err) {
    send({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

function handleMessage(raw: string) {
  let msg: WorkerInbound
  try {
    msg = JSON.parse(raw) as WorkerInbound
  } catch {
    send({ type: 'error', message: '无效的 JSON 输入' })
    return
  }

  if (msg.type === 'init') {
    initPayload = {
      ...msg,
      dataDir: msg.dataDir || resolveDataDir(msg.projectRoot),
    }
    return
  }

  if (msg.type === 'proxy_result') {
    const waiter = proxyWaiters.get(msg.requestId)
    if (!waiter) return
    proxyWaiters.delete(msg.requestId)
    if (msg.ok) {
      waiter.resolve(msg.result)
    } else {
      waiter.reject(new Error(msg.error ?? 'Tool proxy 失败'))
    }
    return
  }

  if (msg.type === 'run') {
    void handleRun(msg.id, msg.userInput, msg.history, msg.sessionId)
    return
  }

  if (msg.type === 'investigate') {
    void handleInvestigate(msg.id, msg.name, msg.university, msg.maxPapers)
  }
}

const rl = readline.createInterface({ input, crlfDelay: Infinity })
rl.on('line', handleMessage)
rl.on('close', () => process.exit(0))

send({ type: 'ready' })
