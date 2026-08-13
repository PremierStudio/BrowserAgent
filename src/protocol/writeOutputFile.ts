import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Write a CI report or JUnit file, creating parent directories. */
export function writeOutputFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}
