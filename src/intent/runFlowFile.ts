import type { ContextPage } from '../context/ContextPage.js'
import { saveFlow, type FlowFile } from './flowFile.js'
import { runFlow, type RunFlowOptions } from './runFlow.js'

/** Run a durable file. Re-checks save rules, then plays the named steps. */
export async function runFlowFile(
  page: ContextPage,
  file: FlowFile,
  options: RunFlowOptions = {},
): Promise<{ ok: true; name: string; steps: number }> {
  const saved = saveFlow(file)
  if (!saved.ok) {
    throw new Error(saved.error)
  }
  const result = await runFlow(page, [...saved.file.steps], options)
  return { ok: true, name: saved.file.name, steps: result.steps }
}
