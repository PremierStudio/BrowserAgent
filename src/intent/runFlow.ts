import type { ContextPage } from '../context/ContextPage.js'

/** A single step in a run_flow sequence. */
export interface FlowStep {
  action: string
  uid?: string
  text?: string
  dx?: number
  dy?: number
  value?: string
  key?: string
  url?: string
}

function requireUid(step: FlowStep): string {
  if (step.uid === undefined) {
    throw new Error(`action ${step.action} requires uid`)
  }
  return step.uid
}

/** Runs a sequence of page actions and returns the number of steps executed. */
export async function runFlow(
  page: ContextPage,
  steps: FlowStep[],
): Promise<{ ok: true; steps: number }> {
  for (const step of steps) {
    if (step.action === 'click') {
      await page.click(requireUid(step))
      continue
    }
    if (step.action === 'type') {
      await page.type(requireUid(step), step.text ?? '')
      continue
    }
    if (step.action === 'hover') {
      await page.hover(requireUid(step))
      continue
    }
    if (step.action === 'scroll') {
      await page.scroll(requireUid(step), step.dx ?? 0, step.dy ?? 0)
      continue
    }
    if (step.action === 'select') {
      await page.select(requireUid(step), step.value ?? '')
      continue
    }
    if (step.action === 'press') {
      if (step.key === undefined) {
        throw new Error('action press requires key')
      }
      await page.press(step.key)
      continue
    }
    if (step.action === 'navigate') {
      if (step.url === undefined) {
        throw new Error('action navigate requires url')
      }
      await page.navigate(step.url)
      continue
    }
    throw new Error(`unknown action: ${step.action}`)
  }
  return { ok: true, steps: steps.length }
}
