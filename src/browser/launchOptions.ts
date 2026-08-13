/** Primary work area used when the OS cannot be probed. */
export const FALLBACK_WORK_AREA: WorkArea = {
  x: 0,
  y: 40,
  width: 1920,
  height: 1040,
}

/** PowerShell that prints primary WorkingArea as x,y,width,height. */
export const WINDOWS_WORK_AREA_COMMAND =
  'Add-Type -AssemblyName System.Windows.Forms; $w = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea; Write-Output "$($w.X),$($w.Y),$($w.Width),$($w.Height)"'

export type WorkArea = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Headed Chrome is opt-in. Anything other than "1" stays headless. */
export function headedFromEnv(env: Record<string, string | undefined>): boolean {
  return env.BROWSER_AGENT_HEADED === '1'
}

/**
 * Launch decision. `--headed` or BROWSER_AGENT_HEADED=1 force a window.
 * BROWSER_AGENT_HEADED=0 forces headless. Unset defaults to headed so an MCP
 * host that drops the env map still opens a visible Chrome.
 */
export function headedRequested(
  env: Record<string, string | undefined>,
  argv: readonly string[],
): boolean {
  if (argv.includes('--headed')) {
    return true
  }
  return env.BROWSER_AGENT_HEADED !== '0'
}

/** Left half of the work area: full height, origin unchanged. */
export function leftSnapBounds(work: WorkArea): WorkArea {
  return {
    x: work.x,
    y: work.y,
    width: Math.floor(work.width / 2),
    height: work.height,
  }
}

/** Parse `x,y,width,height`. Rejects empty, malformed, and non-positive sizes. */
export function parseWorkAreaCsv(raw: string | undefined): WorkArea | undefined {
  if (raw === undefined) {
    return undefined
  }
  const parts = raw.split(',')
  if (parts.length > 4) {
    return undefined
  }
  const x = Number(parts[0])
  const y = Number(parts[1])
  const width = Number(parts[2])
  const height = Number(parts[3])
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return undefined
  }
  if (width <= 0 || height <= 0) {
    return undefined
  }
  return { x, y, width, height }
}

/**
 * Env `BROWSER_AGENT_WORK_AREA` wins, then a host probe (Windows WorkingArea
 * csv), then FALLBACK_WORK_AREA.
 */
export function resolveWorkArea(
  env: Record<string, string | undefined>,
  probed: string | undefined,
): WorkArea {
  return (
    parseWorkAreaCsv(env.BROWSER_AGENT_WORK_AREA) ?? parseWorkAreaCsv(probed) ?? FALLBACK_WORK_AREA
  )
}

/**
 * Keeps save-password, leak-check, and "weak password" bubbles off the page
 * so headed automation stays visible. Applied on every launch, including MCP.
 */
export const QUIET_CHROME_ARGS: readonly string[] = [
  '--disable-save-password-bubble',
  '--password-store=basic',
  '--disable-features=PasswordLeakDetection,PasswordManagerOnboarding,SafeBrowsingEnhancedProtection',
]

function chromeArgs(extra: readonly string[]): string[] {
  const args: string[] = []
  for (const flag of extra) {
    args.push(flag)
  }
  for (const flag of QUIET_CHROME_ARGS) {
    args.push(flag)
  }
  return args
}

export function puppeteerLaunchOptions(
  headed: boolean,
  workArea: WorkArea = FALLBACK_WORK_AREA,
): {
  headless: boolean
  defaultViewport: { width: number; height: number } | null
  args: string[]
} {
  if (headed) {
    const snap = leftSnapBounds(workArea)
    return {
      headless: false,
      defaultViewport: null,
      args: chromeArgs([
        `--window-position=${snap.x},${snap.y}`,
        `--window-size=${snap.width},${snap.height}`,
      ]),
    }
  }
  return {
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
    args: chromeArgs([]),
  }
}

/** Reuse the tab launch already opened. Do not call newPage first. */
export async function firstBrowserPage<T>(
  pages: () => Promise<readonly T[]>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await pages()
  const first = existing[0]
  if (first !== undefined) {
    return first
  }
  return create()
}
