/**
 * Validation utilities for ArtNet configuration
 */

export function validateHost(host: string): boolean {
  return host.length > 0
}

export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

export function validateUniverse(
  net: number,
  subnet: number,
  universe: number
): boolean {
  return (
    Number.isInteger(net) &&
    net >= 0 &&
    net <= 127 &&
    Number.isInteger(subnet) &&
    subnet >= 0 &&
    subnet <= 15 &&
    Number.isInteger(universe) &&
    universe >= 0 &&
    universe <= 15
  )
}
