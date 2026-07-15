/**
 * Shared currency formatting utility.
 * The entire Vinocellar system uses Kenyan Shillings (KSh).
 */

/** Format a number as KSh currency string.
 *  Examples: formatKSh(1500) => "KSh 1,500"  |  formatKSh(1500.5) => "KSh 1,500.50"
 */
export function formatKSh(amount: number): string {
  return (
    'KSh ' +
    Number(amount).toLocaleString('en-KE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  )
}

/** Currency symbol used throughout the app */
export const CURRENCY_SYMBOL = 'KSh'
export const CURRENCY_CODE = 'KES'