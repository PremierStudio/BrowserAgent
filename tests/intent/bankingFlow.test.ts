import { describe, expect, it } from 'vitest'
import { BANKING_LOGIN, BANKING_STEPS } from '../../src/intent/bankingFlow.js'

describe('bankingFlow', () => {
  it('is the customer deposit sequence and stops on the account', () => {
    expect(BANKING_STEPS).toHaveLength(7)
    expect(BANKING_STEPS[0]).toEqual({
      action: 'navigate',
      url: BANKING_LOGIN,
      expectUrl: 'BankingProject',
      expectText: 'XYZ Bank',
    })
    expect(BANKING_STEPS[2]).toEqual({
      action: 'select',
      name: 'Your Name',
      value: 'Harry Potter',
    })
    expect(BANKING_STEPS[6]).toEqual({
      action: 'click',
      name: 'Deposit',
      near: 'Amount to be Deposited',
      expectText: 'Deposit Successful',
    })
    for (const step of BANKING_STEPS) {
      expect(step.action).not.toBe('observe')
      expect(
        step.name === 'Transactions' || step.name === 'Withdrawl' || step.name === 'Withdraw',
      ).toBe(false)
    }
  })
})
