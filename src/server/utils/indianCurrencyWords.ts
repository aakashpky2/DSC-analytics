/**
 * Helper to convert numbers to Indian Currency Words
 * e.g. 5900 -> Five Thousand Nine Hundred Rupees Only
 * e.g. 100000 -> One Lakh Rupees Only
 * e.g. 3540.50 -> Three Thousand Five Hundred Forty Rupees and Fifty Paise Only
 */

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
]

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
]

function convertBelowThousand(n: number): string {
  let str = ''
  if (n >= 100) {
    str += ones[Math.floor(n / 100)] + ' Hundred '
    n %= 100
  }
  if (n >= 20) {
    str += tens[Math.floor(n / 10)] + ' '
    n %= 10
  }
  if (n > 0) {
    str += ones[n] + ' '
  }
  return str.trim()
}

export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Zero Rupees Only'
  
  const absoluteAmount = Math.abs(amount)
  const rupees = Math.floor(absoluteAmount)
  const paise = Math.round((absoluteAmount - rupees) * 100)

  let words = ''

  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const remainder = Math.floor(rupees % 1000)

  if (crore > 0) {
    words += convertBelowThousand(crore) + ' Crore '
  }
  if (lakh > 0) {
    words += convertBelowThousand(lakh) + ' Lakh '
  }
  if (thousand > 0) {
    words += convertBelowThousand(thousand) + ' Thousand '
  }
  if (remainder > 0) {
    words += convertBelowThousand(remainder) + ' '
  }

  if (rupees === 1) {
    words = 'One Rupee'
  } else {
    words = words.trim() + ' Rupees'
  }

  if (paise > 0) {
    words += ' and ' + convertBelowThousand(paise) + ' Paise'
  }

  return words + ' Only'
}
