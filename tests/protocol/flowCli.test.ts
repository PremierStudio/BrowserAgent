import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { saveFlow, serializeFlowFile } from '../../src/intent/flowFile.js'
import type { FlowFile } from '../../src/intent/flowFile.js'
import { executeFlowCli, parseCliCommand } from '../../src/protocol/flowCli.js'

const saved = saveFlow({
  name: 'login',
  steps: [{ action: 'click', name: 'Login', expectText: 'Home' }],
})

function fileText(): string {
  if (!saved.ok) {
    throw new Error('fixture must save')
  }
  return serializeFlowFile(saved.file)
}

describe('parseCliCommand', () => {
  it('defaults to the MCP stdio server', () => {
    expect(parseCliCommand(['node', 'cli.js'])).toEqual({ kind: 'mcp' })
  })

  it('serves Streamable HTTP when asked', () => {
    expect(parseCliCommand(['node', 'cli.js', '--http'])).toEqual({ kind: 'http' })
  })

  it('runs or compiles a flow file', () => {
    expect(parseCliCommand(['node', 'cli.js', 'run', 'flows/a.json'])).toEqual({
      kind: 'run',
      path: 'flows/a.json',
    })
    expect(parseCliCommand(['node', 'cli.js', 'compile', 'flows/a.json'])).toEqual({
      kind: 'compile',
      path: 'flows/a.json',
    })
  })

  it('refuses a missing path or leftover args', () => {
    expect(parseCliCommand(['node', 'cli.js', 'run'])).toEqual({
      kind: 'usage',
      error: 'usage: browser-agent run <file.json> | compile <file.json> | --http',
    })
    expect(parseCliCommand(['node', 'cli.js', 'compile'])).toEqual({
      kind: 'usage',
      error: 'usage: browser-agent run <file.json> | compile <file.json> | --http',
    })
    expect(parseCliCommand(['node', 'cli.js', 'run', 'a.json', 'extra'])).toEqual({
      kind: 'usage',
      error: 'usage: browser-agent run <file.json> | compile <file.json> | --http',
    })
    expect(parseCliCommand(['node', 'cli.js', 'wat'])).toEqual({
      kind: 'usage',
      error: 'usage: browser-agent run <file.json> | compile <file.json> | --http',
    })
    expect(parseCliCommand(['node', 'cli.js', 'run', ''])).toEqual({
      kind: 'usage',
      error: 'usage: browser-agent run <file.json> | compile <file.json> | --http',
    })
  })
})

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'login.flow.json',
)

describe('executeFlowCli', () => {
  it('compiles the checked-in fixture from disk', async () => {
    const lines: string[] = []
    const code = await executeFlowCli(
      { kind: 'compile', path: fixturePath },
      {
        readFile: (path) => readFileSync(path, 'utf8'),
        writeOut: (line) => {
          lines.push(line)
        },
        writeErr: () => undefined,
      },
    )
    expect(code).toBe(0)
    expect(lines.join('\n')).toBe('ok compile name=login steps=3')
  })

  it('compiles a durable file and prints ok', async () => {
    const lines: string[] = []
    const code = await executeFlowCli(
      { kind: 'compile', path: 'flows/login.json' },
      {
        readFile: (path) => {
          expect(path).toBe('flows/login.json')
          return fileText()
        },
        writeOut: (line) => {
          lines.push(line)
        },
        writeErr: () => undefined,
      },
    )
    expect(code).toBe(0)
    expect(lines.join('\n')).toMatch(/ok compile name=login steps=1/)
  })

  it('returns 1 when the file is not durable', async () => {
    const errors: string[] = []
    const code = await executeFlowCli(
      { kind: 'compile', path: 'bad.json' },
      {
        readFile: () => '{"version":1,"name":"x","steps":[{"action":"click","name":"Login"}]}',
        writeOut: () => undefined,
        writeErr: (line) => {
          errors.push(line)
        },
      },
    )
    expect(code).toBe(1)
    expect(errors.join('\n')).toMatch(/requires expectUrl or expectText/)
  })

  it('runs a durable file through the injected runner', async () => {
    const lines: string[] = []
    let ran: FlowFile | undefined
    const code = await executeFlowCli(
      { kind: 'run', path: 'flows/login.json' },
      {
        readFile: () => fileText(),
        writeOut: (line) => {
          lines.push(line)
        },
        writeErr: () => undefined,
        runFile: async (file) => {
          ran = file
          return { ok: true, steps: file.steps.length }
        },
      },
    )
    expect(code).toBe(0)
    expect(ran?.name).toBe('login')
    expect(lines.join('\n')).toMatch(/ok run name=login steps=1/)
  })

  it('returns 1 when the runner throws, with the error text', async () => {
    const errors: string[] = []
    const code = await executeFlowCli(
      { kind: 'run', path: 'flows/login.json' },
      {
        readFile: () => fileText(),
        writeOut: () => undefined,
        writeErr: (line) => {
          errors.push(line)
        },
        runFile: async () => {
          throw 'step 1 click: no target'
        },
      },
    )
    expect(code).toBe(1)
    expect(errors.join('\n')).toBe('step 1 click: no target')
  })

  it('returns 1 when the runner is missing', async () => {
    const errors: string[] = []
    const code = await executeFlowCli(
      { kind: 'run', path: 'flows/login.json' },
      {
        readFile: () => fileText(),
        writeOut: () => undefined,
        writeErr: (line) => {
          errors.push(line)
        },
      },
    )
    expect(code).toBe(1)
    expect(errors.join('\n')).toMatch(/run requires a page/)
  })

  it('returns 1 when the file cannot be read', async () => {
    const errors: string[] = []
    const code = await executeFlowCli(
      { kind: 'compile', path: 'missing.json' },
      {
        readFile: () => {
          throw new Error('ENOENT')
        },
        writeOut: () => undefined,
        writeErr: (line) => {
          errors.push(line)
        },
      },
    )
    expect(code).toBe(1)
    expect(errors.join('\n')).toBe('ENOENT')
  })

  it('does not run mcp through the file command', async () => {
    const errors: string[] = []
    expect(
      await executeFlowCli(
        { kind: 'mcp' },
        {
          readFile: () => {
            throw new Error('should not read')
          },
          writeOut: () => undefined,
          writeErr: (line) => {
            errors.push(line)
          },
        },
      ),
    ).toBe(1)
    expect(errors).toEqual(['usage: browser-agent run <file.json> | compile <file.json> | --http'])
  })

  it('does not run http through the file command', async () => {
    const errors: string[] = []
    expect(
      await executeFlowCli(
        { kind: 'http' },
        {
          readFile: () => {
            throw new Error('should not read')
          },
          writeOut: () => undefined,
          writeErr: (line) => {
            errors.push(line)
          },
        },
      ),
    ).toBe(1)
    expect(errors).toEqual(['usage: browser-agent run <file.json> | compile <file.json> | --http'])
  })

  it('prints usage and returns 1', async () => {
    const errors: string[] = []
    const code = await executeFlowCli(
      { kind: 'usage', error: 'usage: browser-agent run <file.json>' },
      {
        readFile: () => '',
        writeOut: () => undefined,
        writeErr: (line) => {
          errors.push(line)
        },
      },
    )
    expect(code).toBe(1)
    expect(errors.join('\n')).toMatch(/usage: browser-agent run/)
  })
})
