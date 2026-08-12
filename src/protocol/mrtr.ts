import { acceptedContent, inputRequired } from '@modelcontextprotocol/server'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Builds a human-in-the-loop confirmation gate (decision #4): an
 * InputRequiredResult that elicits a boolean confirm via form-mode
 * elicitation/create.
 */
export function confirmGate(message: string, requestState: string) {
  return inputRequired({
    requestState,
    inputRequests: {
      confirm: inputRequired.elicit({
        message,
        requestedSchema: {
          type: 'object',
          properties: { confirm: { type: 'boolean' } },
          required: ['confirm'],
        },
      }),
    },
  })
}

/**
 * Returns true when the client accepted the confirm elicit (or sent the
 * blocking-wait fallback `{ confirmed: true }`).
 */
export function isConfirmed(responses: unknown): boolean {
  if (!isRecord(responses)) {
    return false
  }
  const accepted = acceptedContent<{ confirm?: unknown }>(responses, 'confirm')
  if (accepted !== undefined) {
    return accepted.confirm === true
  }
  return responses.confirmed === true
}
