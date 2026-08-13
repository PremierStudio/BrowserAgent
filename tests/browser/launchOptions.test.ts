import { describe, expect, it } from 'vitest'
import {
  FALLBACK_WORK_AREA,
  QUIET_CHROME_ARGS,
  WINDOWS_WORK_AREA_COMMAND,
  firstBrowserPage,
  headedFromEnv,
  headedRequested,
  leftSnapBounds,
  parseWorkAreaCsv,
  puppeteerLaunchOptions,
  resolveWorkArea,
} from '../../src/browser/launchOptions.js'

describe('headedFromEnv', () => {
  it('is headed only when BROWSER_AGENT_HEADED is 1', () => {
    expect(headedFromEnv({ BROWSER_AGENT_HEADED: '1' })).toBe(true)
    expect(headedFromEnv({ BROWSER_AGENT_HEADED: '0' })).toBe(false)
    expect(headedFromEnv({ BROWSER_AGENT_HEADED: 'true' })).toBe(false)
    expect(headedFromEnv({})).toBe(false)
  })
})

describe('headedRequested', () => {
  it('is headed unless BROWSER_AGENT_HEADED is 0', () => {
    expect(headedRequested({ BROWSER_AGENT_HEADED: '1' }, [])).toBe(true)
    expect(headedRequested({ BROWSER_AGENT_HEADED: '0' }, [])).toBe(false)
    expect(headedRequested({ BROWSER_AGENT_HEADED: '0' }, ['--headed'])).toBe(true)
    expect(headedRequested({}, ['node', 'cli.js', '--headed'])).toBe(true)
    expect(headedRequested({}, ['node', 'cli.js'])).toBe(true)
  })
})

describe('leftSnapBounds', () => {
  it('takes the left half of the primary work area', () => {
    expect(leftSnapBounds({ x: 0, y: 40, width: 2560, height: 1366 })).toEqual({
      x: 0,
      y: 40,
      width: 1280,
      height: 1366,
    })
  })

  it('floors an odd work width and keeps a non-zero origin', () => {
    expect(leftSnapBounds({ x: -1920, y: 0, width: 1921, height: 1080 })).toEqual({
      x: -1920,
      y: 0,
      width: 960,
      height: 1080,
    })
  })
})

describe('parseWorkAreaCsv', () => {
  it('reads x,y,width,height and allows spaces around numbers', () => {
    expect(parseWorkAreaCsv('0, 40, 2560, 1366')).toEqual({
      x: 0,
      y: 40,
      width: 2560,
      height: 1366,
    })
    expect(parseWorkAreaCsv('0,0,1,1')).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('rejects missing, empty, malformed, and non-positive sizes', () => {
    expect(parseWorkAreaCsv(undefined)).toBeUndefined()
    expect(parseWorkAreaCsv('')).toBeUndefined()
    expect(parseWorkAreaCsv('0,40,2560')).toBeUndefined()
    expect(parseWorkAreaCsv('0,40,2560,1366,1')).toBeUndefined()
    expect(parseWorkAreaCsv('a,b,c,d')).toBeUndefined()
    expect(parseWorkAreaCsv('nan,40,2560,1366')).toBeUndefined()
    expect(parseWorkAreaCsv('0,nan,2560,1366')).toBeUndefined()
    expect(parseWorkAreaCsv('0,40,nan,1366')).toBeUndefined()
    expect(parseWorkAreaCsv('0,40,2560,nan')).toBeUndefined()
    expect(parseWorkAreaCsv('0,40,0,1366')).toBeUndefined()
    expect(parseWorkAreaCsv('0,40,2560,0')).toBeUndefined()
    expect(parseWorkAreaCsv('0,40,-1,1366')).toBeUndefined()
    expect(parseWorkAreaCsv('0,40,2560,-2')).toBeUndefined()
  })
})

describe('resolveWorkArea', () => {
  it('prefers BROWSER_AGENT_WORK_AREA over a probe', () => {
    expect(
      resolveWorkArea({ BROWSER_AGENT_WORK_AREA: '10,20,2000,1000' }, '0,40,2560,1366'),
    ).toEqual({ x: 10, y: 20, width: 2000, height: 1000 })
  })

  it('uses the probe when the env override is missing or invalid', () => {
    expect(resolveWorkArea({}, '0,40,2560,1366')).toEqual({
      x: 0,
      y: 40,
      width: 2560,
      height: 1366,
    })
    expect(resolveWorkArea({ BROWSER_AGENT_WORK_AREA: 'nope' }, '0,40,2560,1366')).toEqual({
      x: 0,
      y: 40,
      width: 2560,
      height: 1366,
    })
  })

  it('falls back when neither env nor probe is usable', () => {
    expect(resolveWorkArea({}, undefined)).toEqual(FALLBACK_WORK_AREA)
    expect(resolveWorkArea({ BROWSER_AGENT_WORK_AREA: '' }, 'bad')).toEqual(FALLBACK_WORK_AREA)
  })
})

describe('WINDOWS_WORK_AREA_COMMAND', () => {
  it('prints the primary WorkingArea as x,y,width,height', () => {
    expect(WINDOWS_WORK_AREA_COMMAND).toContain('System.Windows.Forms')
    expect(WINDOWS_WORK_AREA_COMMAND).toContain('WorkingArea')
    expect(WINDOWS_WORK_AREA_COMMAND).toContain('$w.X),$($w.Y),$($w.Width),$($w.Height)')
  })
})

describe('puppeteerLaunchOptions', () => {
  it('locks a 1280x800 viewport in headless and still quiets password UI', () => {
    const launched = puppeteerLaunchOptions(false)
    expect(launched.headless).toBe(true)
    expect(launched.defaultViewport).toEqual({ width: 1280, height: 800 })
    expect(launched.args).toEqual(QUIET_CHROME_ARGS)
  })

  it('snaps the headed window to the left half of the work area', () => {
    expect(puppeteerLaunchOptions(true, { x: 0, y: 40, width: 2560, height: 1366 })).toEqual({
      headless: false,
      defaultViewport: null,
      args: ['--window-position=0,40', '--window-size=1280,1366', ...QUIET_CHROME_ARGS],
    })
  })

  it('uses the fallback work area when none is supplied', () => {
    const snap = leftSnapBounds(FALLBACK_WORK_AREA)
    expect(puppeteerLaunchOptions(true)).toEqual({
      headless: false,
      defaultViewport: null,
      args: [
        `--window-position=${snap.x},${snap.y}`,
        `--window-size=${snap.width},${snap.height}`,
        ...QUIET_CHROME_ARGS,
      ],
    })
  })

  it('pins the quiet flags that keep password and leak bubbles off the page', () => {
    expect(QUIET_CHROME_ARGS).toEqual([
      '--disable-save-password-bubble',
      '--password-store=basic',
      '--disable-features=PasswordLeakDetection,PasswordManagerOnboarding,SafeBrowsingEnhancedProtection',
    ])
    const headed = puppeteerLaunchOptions(true).args
    for (const flag of QUIET_CHROME_ARGS) {
      expect(headed).toContain(flag)
    }
  })
})

describe('firstBrowserPage', () => {
  it('reuses the page launch already opened', async () => {
    const existing = { id: 'first' }
    const created: unknown[] = []
    const page = await firstBrowserPage(
      async () => [existing],
      async () => {
        const next = { id: 'second' }
        created.push(next)
        return next
      },
    )
    expect(page).toBe(existing)
    expect(created).toEqual([])
  })

  it('creates a page only when launch left none', async () => {
    const created = { id: 'created' }
    const page = await firstBrowserPage(
      async () => [],
      async () => created,
    )
    expect(page).toBe(created)
  })
})
