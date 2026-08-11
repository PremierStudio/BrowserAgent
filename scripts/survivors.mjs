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
import { resolve } from 'node:path'

const PROJECT_ROOT = resolve(import.meta.dirname, '..')
const REPORT_PATH = resolve(PROJECT_ROOT, 'reports', 'mutation.json')
const REGISTRY_PATH = resolve(PROJECT_ROOT, 'mutation-survivors.json')

function fail(message) {
  console.error(`[survivors] ${message}`)
  process.exitCode = 1
}

function isPlainApproved(approvedId, survivor, fileName) {
  if (approvedId !== survivor.id) return false
  // mutatorName is always required so the approval is precise.
  if (survivor.mutatorName == null) {
    fail(`${fileName} mutant ${approvedId} has no mutatorName to approve`)
    return false
  }
  // The strict form binds the id to a location; the loose form does not
  // bind it to a location (tolerant for unstable line numbers) but still
  // requires the mutator name above.
  const loose =
    typeof approvedId === 'string' &&
    (approvedId.startsWith('analysis:') ||
      approvedId.startsWith('unreachable:') ||
      approvedId.startsWith('defensive:'))
  if (loose) return true
  // Exact location match: `${start.line}:${start.column}-${end.line}:${end.column}`
  if (survivor.location == null) return false
  const location = `${survivor.location.start.line}:${survivor.location.start.column}-${survivor.location.end.line}:${survivor.location.end.column}`
  return approvedId === `${survivor.id}@${location}`
}

function main() {
  let report
  try {
    report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'))
  } catch (error) {
    fail(`cannot read ${REPORT_PATH} (run 'npm run mutation' first): ${error.message}`)
    return
  }

  let registry
  try {
    registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'))
  } catch (error) {
    fail(`cannot read ${REGISTRY_PATH}: ${error.message}`)
    return
  }
  if (registry == null || typeof registry !== 'object' || Array.isArray(registry)) {
    fail(
      `${REGISTRY_PATH} must be a JSON object of the form { "<file>": <array of approved mutant ids> }`,
    )
    return
  }

  const totalByFile = Object.create(null)
  const violations = [] // [{ file, id, reason }]
  for (const [fileName, fileEntry] of Object.entries(report.files ?? {})) {
    const mutants = fileEntry.mutants ?? []
    totalByFile[fileName] = (totalByFile[fileName] ?? 0) + mutants.length
    const approved = registry[fileName] ?? [] // an unlisted file has no pre-approvals
    if (!Array.isArray(approved)) {
      fail(`registry entry for ${fileName} must be an array of approved mutant ids`)
      continue
    }
    for (const mutant of mutants) {
      if (mutant.status !== 'Survived') continue
      let matched = false
      for (const approvedId of approved) {
        if (typeof approvedId !== 'string') continue
        if (isPlainApproved(approvedId, mutant, fileName)) {
          matched = true
          break
        }
      }
      if (!matched) {
        violations.push({
          file: fileName,
          id: mutant.id ?? null,
          mutator: mutant.mutatorName ?? null,
          location: mutant.location
            ? `${mutant.location.start.line}:${mutant.location.start.column}-${mutant.location.end.line}:${mutant.location.end.column}`
            : null,
          reason: 'surviving mutant not in the pre-approved survivor registry',
        })
      }
    }
  }

  if (violations.length > 0) {
    fail(`${violations.length} surviving mutant(s) not approved in ${REGISTRY_PATH}:`)
    for (const v of violations) {
      console.error(
        `  - ${v.file} [#${v.id} ${v.mutator ?? '?'} @ ${v.location ?? '?'}] ${v.reason}`,
      )
    }
  } else {
    console.log(
      `[survivors] OK — ${Object.keys(totalByFile).length} file(s), ${Object.values(totalByFile).reduce((a, b) => a + b, 0)} mutant(s), 0 survivors unapproved.`,
    )
  }
}

main()
