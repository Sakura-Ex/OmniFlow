import { NetworkConfigurationSchema, type NetworkConfiguration } from '@/common/schemas/network.schema'
export * from '@/common/schemas/network.schema'

/**
 * Remap selected document identities, isolating copied fixed-ratio groups.
 * @param configuration - Full document policy before selection.
 * @param nodeIds - Selected old/new machine identities.
 * @param portAddresses - Selected old/new persistent port addresses.
 * @returns Only selected policies, with all ratio members kept together.
 */
export function remapNetworkConfiguration(configuration: NetworkConfiguration, nodeIds: Record<string, string>, portAddresses: Record<string, string>): NetworkConfiguration {
  const groups = new Map<string, string[]>()
  for (const [address, policy] of Object.entries(configuration.ports)) {
    const boundary = policy.boundary
    const objective = boundary?.kind === 'delivery' ? boundary.objective : boundary && boundary.kind !== 'forbid_spill' ? boundary.cost : undefined
    if (objective?.ratioGroup) groups.set(objective.ratioGroup, [...groups.get(objective.ratioGroup) ?? [], address])
  }
  for (const [group, members] of groups) {
    if (members.some(address => address in portAddresses) && members.some(address => !(address in portAddresses))) throw new Error(`Copy all fixed-ratio group members together: ${group}`)
  }
  const copiedPorts = Object.entries(configuration.ports).filter(([address]) => address in portAddresses).map(([address, policy]) => {
    const copied = structuredClone(policy)
    const boundary = copied.boundary
    const objective = boundary?.kind === 'delivery' ? boundary.objective : boundary && boundary.kind !== 'forbid_spill' ? boundary.cost : undefined
    if (objective?.ratioGroup) objective.ratioGroup = JSON.stringify(['copy', objective.ratioGroup, groups.get(objective.ratioGroup)!.map(member => portAddresses[member]).sort()])
    return [portAddresses[address], copied]
  })
  return NetworkConfigurationSchema.parse({
    ...configuration,
    ports: Object.fromEntries(copiedPorts),
    machines: Object.fromEntries(Object.entries(configuration.machines).filter(([id]) => id in nodeIds).map(([id, policy]) => [nodeIds[id] ?? id, structuredClone(policy)])),
  })
}
