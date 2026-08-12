import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { buildCliMain } from './protocol/cli.js'

// The runnable entry point: serve the BrowserAgent MCP server over stdio.
buildCliMain((factory) => serveStdio(factory))()
