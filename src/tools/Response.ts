/**
 * A deferred response builder. Heavy artifacts (snapshot, screenshot, overlay,
 * events) are attached incrementally and only materialized into a plain object
 * when `handle()` completes, so nothing is serialized before it is needed.
 */
export class Response {
  private snapshotValue: unknown
  private imageValue: string | undefined
  private overlayValue: Record<string, unknown> | undefined
  private eventsValue: unknown[] | undefined

  attachSnapshot(snapshot: unknown): void {
    this.snapshotValue = snapshot
  }

  attachImage(image: string): void {
    this.imageValue = image
  }

  attachOverlay(overlay: Record<string, unknown>): void {
    this.overlayValue = overlay
  }

  attachEvents(events: unknown[]): void {
    this.eventsValue = events
  }

  /** Materializes the accumulated attachments into a plain result object. */
  materialize(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    if (this.snapshotValue !== undefined) {
      result.snapshot = this.snapshotValue
    }
    if (this.imageValue !== undefined) {
      result.image = this.imageValue
    }
    if (this.overlayValue !== undefined) {
      result.overlay = this.overlayValue
    }
    if (this.eventsValue !== undefined) {
      result.events = this.eventsValue
    }
    return result
  }
}
