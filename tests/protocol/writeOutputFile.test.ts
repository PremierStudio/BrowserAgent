import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeOutputFile } from '../../src/protocol/writeOutputFile.js'

describe('writeOutputFile', () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots) {
      rmSync(root, { recursive: true, force: true })
    }
    roots.length = 0
  })

  it('creates missing parent directories then writes the file', () => {
    const root = mkdtempSync(join(tmpdir(), 'browser-engine-out-'))
    roots.push(root)
    const path = join(root, 'reports', 'nested', 'login.json')
    writeOutputFile(path, '{"ok":true}\n')
    expect(readFileSync(path, 'utf8')).toBe('{"ok":true}\n')
  })
})
