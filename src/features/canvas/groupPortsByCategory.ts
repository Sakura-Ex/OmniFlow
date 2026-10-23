/** Keep category groups and their members in first-appearance order.
 * @param ports - Resource ports in their original display order.
 * @returns Grouped ports without changing source data or persistent identities.
 */
export function groupPortsByCategory<T extends { category: string; utility_type?: string }>(ports: readonly T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const port of ports) {
    const category = port.utility_type ?? port.category
    const group = groups.get(category)
    if (group) group.push(port)
    else groups.set(category, [port])
  }
  return [...groups.values()].flat()
}
