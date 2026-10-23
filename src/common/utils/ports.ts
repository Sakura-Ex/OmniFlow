/** Minimum persisted port identity shared by endpoints and recipes. */
interface IdentifiedPort { portId?: string; _uid?: string }

/**
 * Assign identities once at the editing/migration boundary, checking node-wide uniqueness.
 * @returns Copies with unique persistent node-local identities.
 * @param ports - Independent ports to inspect.
 * @param scope - Stable migration namespace for missing identities.
 * @param used - Port identities already used within this node.
 */
export function identifyPorts<T extends IdentifiedPort>(ports: T[], scope: string, used = new Set<string>()): T[] {
  return ports.map((port, index) => {
    let portId = port.portId || port._uid || `${scope}:${index}`
    if (port.portId && used.has(portId)) throw new Error(`Duplicate portId: ${portId}`)
    while (used.has(portId)) portId = `${scope}:${index}:${portId}`
    used.add(portId)
    return { ...port, portId }
  })
}

/**
 * Runtime access never falls back to resource identity.
 * @returns Persisted port identity.
 * @param port - Port with a persisted identity.
 */
export function portIdentity(port: IdentifiedPort): string {
  if (!port.portId) throw new Error('Port has no persistent identity')
  return port.portId
}
