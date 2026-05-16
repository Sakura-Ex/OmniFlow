export function sanitizeFloat(num: number, epsilon = 1e-6): number {
  const rounded = Math.round(num)
  return Math.abs(num - rounded) < epsilon ? rounded : num
}

function formatWithSpaceSeparator(num: number, maxDecimals: number): string {
  const cleanNum = sanitizeFloat(num)
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimals }).format(cleanNum)
  return formatted.replace(/,/g, '\u202F')
}

export function formatMachineExact(num: number): string {
  return formatWithSpaceSeparator(num, 2)
}

export function formatCapEx(num: number): string {
  return formatWithSpaceSeparator(Math.ceil(sanitizeFloat(num)), 0)
}

export function formatOpExRate(num: number): string {
  return formatWithSpaceSeparator(num, 3)
}

export function formatProbability(num: number): string {
  return formatWithSpaceSeparator(num * 100, 1) + ' %'
}

export function formatTimeScale(num: number): string {
  return formatWithSpaceSeparator(num, 4)
}
