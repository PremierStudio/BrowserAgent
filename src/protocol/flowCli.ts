import { parseFlowFile, type FlowFile } from '../intent/flowFile.js'

/** How this process was invoked. */
export type CliCommand =
  | { readonly kind: 'mcp' }
  | { readonly kind: 'http' }
  | { readonly kind: 'run'; readonly path: string }
  | { readonly kind: 'compile'; readonly path: string }
  | { readonly kind: 'usage'; readonly error: string }

/** Injected IO so compile/run tests never touch the real filesystem. */
export type FlowCliIo = {
  readFile: (path: string) => string
  writeOut: (line: string) => void
  writeErr: (line: string) => void
  runFile?: (file: FlowFile) => Promise<{ ok: true; steps: number }>
}

/** Printed when the argv is not mcp, http, run, or compile. */
const FLOW_CLI_USAGE = 'usage: browser-agent run <file.json> | compile <file.json> | --http'

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

/** Read process.argv after node and the script path. */
export function parseCliCommand(argv: readonly string[]): CliCommand {
  const args = argv.slice(2)
  if (args[0] === 'run' || args[0] === 'compile') {
    const paths: string[] = []
    for (const [index, arg] of args.entries()) {
      if (index > 0) {
        paths.push(arg)
      }
    }
    if (paths.length === 1) {
      for (const path of paths) {
        if (path !== '') {
          return { kind: args[0], path }
        }
      }
    }
    return { kind: 'usage', error: FLOW_CLI_USAGE }
  }
  if (args.includes('--http')) {
    return { kind: 'http' }
  }
  if (args.length === 0) {
    return { kind: 'mcp' }
  }
  return { kind: 'usage', error: FLOW_CLI_USAGE }
}

/** Compile or run a flow file. MCP and HTTP stay on the existing servers. */
export async function executeFlowCli(command: CliCommand, io: FlowCliIo): Promise<number> {
  if (command.kind === 'mcp' || command.kind === 'http') {
    io.writeErr(FLOW_CLI_USAGE)
    return 1
  }
  if (command.kind === 'usage') {
    io.writeErr(command.error)
    return 1
  }
  let text: string
  try {
    text = io.readFile(command.path)
  } catch (error) {
    io.writeErr(errorMessage(error))
    return 1
  }
  const parsed = parseFlowFile(text)
  if (!parsed.ok) {
    io.writeErr(parsed.error)
    return 1
  }
  if (command.kind === 'compile') {
    io.writeOut(`ok compile name=${parsed.file.name} steps=${parsed.file.steps.length}`)
    return 0
  }
  const runFile = io.runFile
  if (runFile === undefined) {
    io.writeErr('run requires a page')
    return 1
  }
  try {
    const result = await runFile(parsed.file)
    io.writeOut(`ok run name=${parsed.file.name} steps=${result.steps}`)
    return 0
  } catch (error) {
    io.writeErr(errorMessage(error))
    return 1
  }
}
