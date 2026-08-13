import type { OutlineItem } from '../snapshot/outline.js'
import type { FlowStep } from './runFlow.js'
import { bindTarget, formatBindFailure } from './resolveTarget.js'

/** Optional compile rules. requireExpect is off unless the caller asks. */
export type CompileOptions = {
  requireExpect?: boolean
}

/** Unique prefix bind, or a structured refusal. */
export type CompileResult =
  | { readonly ok: true; readonly steps: FlowStep[]; readonly bound: number }
  | { readonly ok: false; readonly error: string }

const BINDABLE = new Set(['click', 'type', 'hover', 'scroll', 'select'])

function cloneStep(step: FlowStep, uid?: string): FlowStep {
  if (uid === undefined) {
    return { ...step }
  }
  return { ...step, uid }
}

function isPageBreak(action: string): boolean {
  return action === 'click' || action === 'navigate' || action === 'press' || action === 'select'
}

function isKnownAction(action: string): boolean {
  return BINDABLE.has(action) || action === 'navigate' || action === 'press' || action === 'check'
}

function structuralError(step: FlowStep, options: CompileOptions): string | undefined {
  if (!isKnownAction(step.action)) {
    return `unknown action: ${step.action}`
  }
  if (step.action === 'press' && step.key === undefined) {
    return 'action press requires key'
  }
  if (step.action === 'navigate' && step.url === undefined) {
    return 'action navigate requires url'
  }
  if (step.action === 'check') {
    if (step.expectUrl === undefined && step.expectText === undefined) {
      return 'action check requires expectUrl or expectText'
    }
  }
  if (
    options.requireExpect === true &&
    (step.action === 'click' || step.action === 'navigate') &&
    step.expectUrl === undefined &&
    step.expectText === undefined
  ) {
    return `action ${step.action} requires expectUrl or expectText`
  }
  return undefined
}

/**
 * Bind the current-page prefix uniquely and leave later pages as names.
 * Stops after the first click, navigate, or press.
 */
export function compileFlow(
  outline: readonly OutlineItem[],
  steps: readonly FlowStep[],
  options: CompileOptions = {},
): CompileResult {
  const compiled: FlowStep[] = []
  let bound = 0
  let open = true
  for (const step of steps) {
    if (!open) {
      compiled.push(cloneStep(step))
      continue
    }
    const error = structuralError(step, options)
    if (error !== undefined) {
      return { ok: false, error }
    }
    if (!BINDABLE.has(step.action)) {
      compiled.push(cloneStep(step))
    } else if (step.uid !== undefined) {
      compiled.push(cloneStep(step))
      bound += 1
    } else if (step.name === undefined) {
      return { ok: false, error: `action ${step.action} requires uid or name` }
    } else {
      const bind = bindTarget(outline, step)
      if (bind.status !== 'bound') {
        return { ok: false, error: formatBindFailure(step, bind) }
      }
      compiled.push(cloneStep(step, bind.uid))
      bound += 1
    }
    if (isPageBreak(step.action)) {
      open = false
    }
  }
  return { ok: true, steps: compiled, bound }
}
