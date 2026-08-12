/**
 * A simple read/write mutex for tool execution.
 *
 * Read-only observations may run concurrently; write operations are
 * serialized and exclude reads. Tokens are opaque strings so callers can
 * release exactly the acquisition they made.
 */
export class ToolMutex {
  private readTokens = new Set<string>()
  private writeHeld = false
  private nextToken = 0

  /** Acquires a read lock. Returns a token, or null when a write is held. */
  acquireRead(): string | null {
    if (this.writeHeld) {
      return null
    }
    const token = `read-${this.nextToken}`
    this.nextToken += 1
    this.readTokens.add(token)
    return token
  }

  /** Releases a previously acquired read lock. Unknown tokens are ignored. */
  releaseRead(token: string): void {
    this.readTokens.delete(token)
  }

  /** Acquires the write lock. Returns true when acquired, false when busy. */
  acquireWrite(): boolean {
    if (this.writeHeld || this.readTokens.size > 0) {
      return false
    }
    this.writeHeld = true
    return true
  }

  /** Releases the write lock. */
  releaseWrite(): void {
    this.writeHeld = false
  }

  /** Whether a write lock is currently held. */
  isWriteHeld(): boolean {
    return this.writeHeld
  }
}
