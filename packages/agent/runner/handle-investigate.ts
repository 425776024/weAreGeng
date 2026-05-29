import {
  investigatePerson,
  type InvestigatePartialPatch,
  type InvestigateStep,
} from '../services/investigate-person'
import { buildNodeAgentDeps } from './build-node-deps'
import type { WorkerInitPayload } from './protocol'

export interface RunWorkerInvestigateOptions {
  init: WorkerInitPayload
  name: string
  university?: string
  maxPapers?: number
  proxyTool: (tool: string, args: Record<string, unknown>) => Promise<unknown>
  onStep?: (step: InvestigateStep) => void
  onPartial?: (patch: InvestigatePartialPatch) => void
}

export async function runWorkerInvestigate(options: RunWorkerInvestigateOptions) {
  const deps = buildNodeAgentDeps({
    projectRoot: options.init.projectRoot,
    dataDir: options.init.dataDir,
    llm: options.init.config.llm,
    search: options.init.config.search,
    sources: options.init.config.sources,
    memoryDbPath: options.init.memoryDbPath,
    proxyTool: options.proxyTool,
  })

  return investigatePerson({
    name: options.name,
    university: options.university,
    maxPapers: options.maxPapers,
    deps,
    sources: options.init.config.sources,
    onStep: options.onStep,
    onPartial: options.onPartial,
  })
}
