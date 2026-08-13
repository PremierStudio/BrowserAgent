import type { FlowStep } from './runFlow.js'

const SHOWCASE_HTTPBIN = 'https://httpbin.org/forms/post'
const SHOWCASE_LOGIN = 'https://the-internet.herokuapp.com/login'
const SHOWCASE_ADD_REMOVE = 'https://the-internet.herokuapp.com/add_remove_elements/'
const SHOWCASE_FORGOT = 'https://the-internet.herokuapp.com/forgot_password'
const SHOWCASE_SAUCE = 'https://www.saucedemo.com/'
const SHOWCASE_CHECKOUT = 'https://www.saucedemo.com/checkout-step-one.html'
const SHOWCASE_TODOS = 'https://demo.playwright.dev/todomvc/'

export const SHOWCASE_TODO_TITLES: readonly string[] = [
  'Watch the HUD type this line',
  'Follow the cursor to the next field',
  'Click like a person, not a paste',
  'Add a backpack and a bike light',
  'Hover the fleece before the cart',
  'Keep the window snapped to the left',
  'Type every character, just quickly',
  'Pause so a human can actually see it',
  'Login without hitting the help heading',
  'Logout is a link, not a button',
  'Order pizza with bacon and mushroom',
  'Submit and scroll the JSON receipt',
  'Add a dozen elements just to watch',
  'Retrieve a password we will never use',
  'Finish checkout as Alex Rivera',
  'Write another todo because it looks good',
  'Check that Sauce Demo still has onesies',
  'Do not get stuck on an empty name',
  'Prefer exact labels over substring traps',
  'Keep going until the list feels long',
  'One more for the people in the back',
  'The last item on a very full board',
]

export const SHOWCASE_ADD_COUNT = 12

/** Build type+Enter pairs for the TodoMVC act. */
export function todoFlowSteps(titles: readonly string[]): FlowStep[] {
  const steps: FlowStep[] = []
  for (const text of titles) {
    steps.push({ action: 'type', name: 'What needs to be done?', text })
    steps.push({ action: 'press', key: 'Enter' })
  }
  return steps
}

/** Repeat a named click. */
export function repeatClick(name: string, count: number): FlowStep[] {
  const steps: FlowStep[] = []
  for (let i = 0; i < count; i += 1) {
    steps.push({ action: 'click', name })
  }
  return steps
}

/**
 * A long headed demo that stays on public, well-labeled pages.
 * Pizza, login, add/remove, forgot-password, full cart checkout, then many todos.
 */
export const SHOWCASE_STEPS: readonly FlowStep[] = [
  { action: 'navigate', url: SHOWCASE_HTTPBIN },
  { action: 'type', name: 'Customer name', text: 'Alex Rivera' },
  { action: 'type', name: 'Telephone', text: '5125550199' },
  { action: 'type', name: 'E-mail address', text: 'alex@example.com' },
  { action: 'click', name: 'Medium' },
  { action: 'click', name: 'Bacon' },
  { action: 'click', name: 'Mushroom' },
  { action: 'type', name: 'Delivery instructions', text: 'Leave at the side door.' },
  { action: 'click', name: 'Submit order' },
  { action: 'press', key: 'PageDown' },
  { action: 'navigate', url: SHOWCASE_LOGIN },
  { action: 'type', name: 'Username', text: 'tomsmith' },
  { action: 'type', name: 'Password', text: 'SuperSecretPassword!' },
  { action: 'click', name: 'Login', expectUrl: '/secure', expectText: 'Logout' },
  { action: 'click', name: 'Logout', expectUrl: '/login' },
  { action: 'navigate', url: SHOWCASE_ADD_REMOVE },
  ...repeatClick('Add Element', SHOWCASE_ADD_COUNT),
  { action: 'navigate', url: SHOWCASE_FORGOT },
  { action: 'type', name: 'E-mail', text: 'alex@example.com' },
  { action: 'click', name: 'Retrieve password' },
  { action: 'navigate', url: SHOWCASE_SAUCE },
  { action: 'type', name: 'Username', text: 'standard_user' },
  { action: 'type', name: 'Password', text: 'secret_sauce' },
  { action: 'click', name: 'Login', expectUrl: '/inventory' },
  { action: 'hover', name: 'Sauce Labs Backpack', role: 'link', near: 'Products' },
  { action: 'click', name: 'Add to cart', near: 'Backpack' },
  { action: 'hover', name: 'Sauce Labs Bike Light', role: 'link', near: 'Products' },
  { action: 'click', name: 'Add to cart', near: 'Bike Light' },
  { action: 'hover', name: 'Sauce Labs Bolt T-Shirt', role: 'link', near: 'Products' },
  { action: 'click', name: 'Add to cart', near: 'Bolt T-Shirt' },
  { action: 'hover', name: 'Sauce Labs Fleece Jacket', role: 'link', near: 'Products' },
  { action: 'click', name: 'Add to cart', near: 'Fleece Jacket' },
  { action: 'hover', name: 'Sauce Labs Onesie', role: 'link', near: 'Products' },
  { action: 'click', name: 'Add to cart', near: 'Onesie' },
  { action: 'hover', name: 'Test.allTheThings() T-Shirt (Red)', role: 'link', near: 'Products' },
  { action: 'click', name: 'Add to cart', near: 'allTheThings' },
  { action: 'navigate', url: SHOWCASE_CHECKOUT },
  { action: 'type', name: 'First Name', text: 'Alex' },
  { action: 'type', name: 'Last Name', text: 'Rivera' },
  { action: 'type', name: 'Zip/Postal Code', text: '78701' },
  { action: 'click', name: 'Continue' },
  { action: 'click', name: 'Finish', expectUrl: '/checkout-complete' },
  { action: 'navigate', url: SHOWCASE_TODOS, expectUrl: 'todomvc' },
  ...todoFlowSteps(SHOWCASE_TODO_TITLES),
]

/** Navigate URLs in order, for tests and the live runner. */
export function showcaseNavigations(): string[] {
  return [
    SHOWCASE_HTTPBIN,
    SHOWCASE_LOGIN,
    SHOWCASE_ADD_REMOVE,
    SHOWCASE_FORGOT,
    SHOWCASE_SAUCE,
    SHOWCASE_CHECKOUT,
    SHOWCASE_TODOS,
  ]
}
