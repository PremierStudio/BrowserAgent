import type { FlowStep } from './runFlow.js'

export const BANKING_LOGIN = 'https://www.globalsqa.com/angularJs-protractor/BankingProject/#/login'

/** Customer deposit on the public XYZ Bank demo. Stops on the account. */
export const BANKING_STEPS: readonly FlowStep[] = [
  {
    action: 'navigate',
    url: BANKING_LOGIN,
    expectUrl: 'BankingProject',
    expectText: 'XYZ Bank',
  },
  { action: 'click', name: 'Customer Login', expectUrl: '/customer', expectText: 'Your Name' },
  { action: 'select', name: 'Your Name', value: 'Harry Potter' },
  { action: 'click', name: 'Login', expectUrl: '/account', expectText: 'Harry Potter' },
  { action: 'click', name: 'Deposit', expectText: 'Amount to be Deposited' },
  { action: 'type', name: 'Amount to be Deposited', text: '150' },
  {
    action: 'click',
    name: 'Deposit',
    near: 'Amount to be Deposited',
    expectText: 'Deposit Successful',
  },
]
