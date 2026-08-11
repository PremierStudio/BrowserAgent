// Mutation survivor registry checker.
//
// Enforces decision #23 of docs/decisions.md: every mutation that survives
// Stryker MUST be a pre-approved, named entry in `mutation-survivors.json`,
// or the gate fails. The registry is the ONLY escape from the 100% mutation
// gate (mvp.md lines 92-96). An allowlist that is never empty and never
// silently updated is what keeps the gate honest.
//
// Exit codes: 0 = all survivors are pre-approved; 1 = gate violation.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_PATH = resolve(PROJECT_ROOT, 'reports', 'mutation.json')
const REGISTRY_PATH = resolve(PROJECT_ROOT, 'mutation-survivors.json')

function fail(message: string) {
  console.error(`[survivors] ${message}`)
  process.exitCode = 1
}

interface SurvivorLocation {
  start: { line: number; column: number }
  end: { line: number; column: number }
}

interface Survivor {
  id: string
  mutatorName: string | null | undefined
  status: string
  location?: SurvivorLocation | null
}

function locationKey(location: SurvivorLocation): string {
  return `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`
}

function isLooseApproved(approvedId: string): boolean {
  return (
    approvedId.startsWith('analysis:') ||
    approvedId.startsWith('unreachable:') ||
    approvedId.startsWith('defensive:')
  )
}

function isPlainApproved(approvedId: string, survivor: Survivor, fileName: string): boolean {
  if (approvedId !== survivor.id) return false
  // mutatorName is always required so the approval is precise.
  if (survivor.mutatorName == null) {
    fail(`${fileName} mutant ${approvedId} has no mutatorName to approve`)
    return false
  }
  // The strict form binds the id to a location; the loose form does not
  // bind it to a location (tolerant for unstable line numbers) but still
  // requires the mutator name above.
  if (isLooseApproved(approvedId)) return true
  // Exact location match: `${start.line}:${start.column}-${end.line}:${end.column}`
  if (survivor.location == null) return false
  return approvedId === `${survivor.id}@${locationKey(survivor.location)}`
}

interface RegistryFile {
  [fileName: string]: unknown
}

interface Violation {
  file: string
  id: string | null
  mutator: string | null
  location: string | null
  reason: string
}

function approveMutant(
  mutant: Survivor,
  approvedIds: readonly string[],
  fileName: string,
): boolean {
  for (const approvedId of approvedIds) {
    if (isPlainApproved(approvedId, mutant, fileName)) return true
  }
  return false
}

function main() {
  let report: { files?: Record<string, { mutants?: Survivor[] }> }
  try {
    report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'))
  } catch (error) {
    fail(`cannot read ${REPORT_PATH} (run 'npm run mutation' first): ${String(error)}`)
    return
  }

  let registry: RegistryFile
  try {
    registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'))
  } catch (error) {
    fail(`cannot read ${REGISTRY_PATH}: ${String(error)}`)
    return
  }
  if (registry == null || typeof registry !== 'object' || Array.isArray(registry)) {
    fail(
      `${REGISTRY_PATH} must be a JSON object of the form { "<file>": <array of approved mutant ids> }`,
    )
    return
  }

  const totalByFile: Record<string, number> = {}
  const violations: Violation[] = []

  for (const [fileName, fileEntry] of Object.entries(report.files ?? {})) {
    const mutants = fileEntry.mutants ?? []
    totalByFile[fileName] = (totalByFile[fileName] ?? 0) + mutants.length
    const approved = registry[fileName] ?? []
    if (!Array.isArray(approved)) {
      fail(`registry entry for ${fileName} must be an array of approved mutant ids`)
      continue
    }
    const approvedIds = approved.filter((entry): entry is string => typeof entry === 'string')
    for (const mutant of mutants) {
      if (mutant.status !== 'Survived') continue
      if (approveMutant(mutant, approvedIds, fileName)) continue
      violations.push({
        file: fileName,
        id: mutant.id ?? null,
        mutator: mutant.mutatorName ?? null,
        location: mutant.location ? locationKey(mutant.location) : null,
        reason: 'surviving mutant not in the pre-approved survivor registry',
      })
    }
  }

  if (violations.length > 0) {
    fail(`${violations.length} surviving mutant(s) not approved in ${REGISTRY_PATH}:`)
    for (const violation of violations) {
      console.error(
        `  - ${violation.file} [#${violation.id} ${violation.mutator ?? '?'} @ ${violation.location ?? '?'}] ${violation.reason}`,
      )
    }
  } else {
    const totalMutants = Object.values(totalByFile).reduce((a, b) => a + b, 0)
    console.log(
      `[survivors] OK — ${Object.keys(totalByFile).length} file(s), ${totalMutants} mutant(s), 0 survivors unapproved.`,
    )
  }
}

main()
