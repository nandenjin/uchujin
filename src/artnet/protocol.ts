/**
 * Art-Net protocol constants and types
 */

export const ARTNET_HEADER = 'Art-Net\0'

/**
 * Art-Net protocol opcodes
 */
export enum ArtNetOpcode {
  OP_POLL = 0x2000,
  OP_POLL_REPLY = 0x2100,
  OP_DATA = 0x5000,
}
