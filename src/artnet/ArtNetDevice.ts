import { EventEmitter } from 'node:events'
import { createSocket, RemoteInfo, Socket } from 'node:dgram'

import { ARTNET_HEADER, ArtNetOpcode } from './protocol'
import type { ArtNetReceiver } from './ArtNetReceiver'

export interface ArtNetDeviceOptions {
  shortName: string
  longName: string
}

/**
 * ArtNetDevice
 * Singleton class to manage ArtNet sockets and dispatch messages.
 */
export class ArtNetDevice extends EventEmitter {
  private static instance: ArtNetDevice

  // Map of "host:port" -> Socket
  private sockets = new Map<string, Socket>()

  // Map of "host:port" -> Set of Receivers
  private receivers = new Map<string, Set<ArtNetReceiver>>()

  shortName: string = 'lightingkit'
  longName: string = 'Lightingkit: ArtNetDevice'

  private constructor() {
    super()
  }

  static getInstance(): ArtNetDevice {
    if (!ArtNetDevice.instance) {
      ArtNetDevice.instance = new ArtNetDevice()
    }
    return ArtNetDevice.instance
  }

  /**
   * Configure the device
   */
  configure(options: ArtNetDeviceOptions) {
    this.shortName = options.shortName
    this.longName = options.longName
  }

  /**
   * Bind a socket to a specific host and port.
   * Returns a key identifying the socket.
   */
  async bind(host: string, port: number): Promise<string> {
    const key = `${host}:${port}`
    if (this.sockets.has(key)) {
      return key
    }

    const socket = createSocket({ type: 'udp4', reuseAddr: true })

    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        socket.removeListener('error', onError)
        resolve()
      }

      const onError = (err: Error) => {
        socket.removeListener('listening', onListening)
        socket.close()
        if (this.sockets.get(key) === socket) {
          this.sockets.delete(key)
        }
        reject(err)
      }

      socket.once('listening', onListening)
      socket.once('error', onError)
      socket.bind(port, host)
    })

    socket.on('message', (msg, rinfo) => this.handleMessage(key, msg, rinfo))
    socket.on('error', (err) => {
      console.error(`Socket error on ${key}:`, err)
      // We might want to notify receivers or emit error
      this.emit('error', err)
    })

    this.sockets.set(key, socket)
    this.receivers.set(key, new Set())

    return key
  }

  /**
   * Register a receiver to listen for data from a specific socket
   */
  registerReceiver(socketKey: string, receiver: ArtNetReceiver) {
    let set = this.receivers.get(socketKey)
    if (!set) {
      set = new Set()
      this.receivers.set(socketKey, set)
    }
    set.add(receiver)
  }

  /**
   * Unregister a receiver
   */
  unregisterReceiver(socketKey: string, receiver: ArtNetReceiver) {
    const set = this.receivers.get(socketKey)
    if (set) {
      set.delete(receiver)
    }
  }

  private handleMessage(key: string, msg: Buffer, rinfo: RemoteInfo) {
    if (msg.length < 12) return

    const header = msg.subarray(0, 8)
    if (header.toString() !== ARTNET_HEADER) return

    const protocolVersion = msg.readUint16BE(10)
    if (protocolVersion !== 14) return

    const opcode = msg.readUint16LE(8)

    switch (opcode) {
      case ArtNetOpcode.OP_POLL:
        // Use the socket associated with 'key' to reply
        this.sendPollReply(key, rinfo)
        break

      case ArtNetOpcode.OP_DATA:
        this.handleOpData(key, msg)
        break
    }
  }

  private handleOpData(key: string, msg: Buffer) {
    const subuni = msg.readUint8(14)
    const subnet = (subuni >> 4) & 0x0f
    const universe = subuni & 0x0f
    const net = msg.readUint8(15)

    // const sequence = msg.readUint8(12); // Used for sequencing, not invalidating here yet
    const length = msg.readUint16BE(16)
    const data = msg.subarray(18, 18 + length) // Buffer slice

    // Find receivers
    const receivers = this.receivers.get(key)
    if (receivers) {
      for (const receiver of receivers) {
        if (
          receiver.net === net &&
          receiver.subnet === subnet &&
          receiver.universe === universe
        ) {
          receiver.handleDmxData(data)
        }
      }
    }
  }

  private sendPollReply(key: string, rinfo: RemoteInfo) {
    const socket = this.sockets.get(key)
    if (!socket) return

    const [host, portStr] = key.split(':')
    const port = parseInt(portStr)

    const reply = Buffer.alloc(239)
    // Header
    reply.write(ARTNET_HEADER, 0)
    reply.writeUInt16LE(ArtNetOpcode.OP_POLL_REPLY, 8)

    // IP
    if (host.match(/\d+\.\d+\.\d+\.\d+/)) {
      const parts = host.split('.').map((v) => parseInt(v))
      parts.forEach((b, i) => reply.writeUInt8(b, 10 + i))
    }

    reply.writeUInt16LE(port, 14)
    reply.writeUInt16BE(0x0100, 16) // Version
    reply.writeUInt8(0, 18) // Net
    reply.writeUInt8(0, 19) // Subnet
    reply.writeUInt16BE(0x00ff, 20) // Oem
    reply.writeUInt8(0, 22) // Ubea
    reply.writeUInt8(0x00, 23) // Status
    reply.writeUInt16LE(0, 24) // ESTA

    reply.write(this.shortName, 26)
    reply.write(this.longName, 44)

    reply.write('Working fine!', 108)
    reply.writeUInt16BE(4, 172) // NumPorts

    const PORT_TYPE = 0x80 // Output
    reply.writeUInt8(PORT_TYPE, 174)
    reply.writeUInt8(PORT_TYPE, 175)
    reply.writeUInt8(PORT_TYPE, 176)
    reply.writeUInt8(PORT_TYPE, 177)

    // ... Zeros for rest ...

    // Mac address (dummy)
    const mac = '00:00:00:00:00:00'
    const macBytes = mac.split(':').map((v) => parseInt(v, 16))
    macBytes.forEach((byte, i) => reply.writeUInt8(byte, 201 + i))

    socket.send(reply, port, rinfo.address, (err) => {
      if (err) console.error('Error sending PollReply:', err)
    })
  }
  /**
   * Send a message to a specific host and port using a managed socket.
   */
  send(socketKey: string, msg: Buffer, host: string, port: number) {
    const socket = this.sockets.get(socketKey)
    if (!socket) {
      console.warn(`[ArtNetDevice] Socket not found for key: ${socketKey}`)
      return
    }
    socket.send(msg, port, host, (err) => {
      if (err) {
        console.error(
          `[ArtNetDevice] Error sending packet to ${host}:${port}`,
          err
        )
        this.emit('error', err)
      }
    })
  }
}

/**
 * Configure the global ArtNet Device settings
 */
export function configureArtNet(options: ArtNetDeviceOptions) {
  ArtNetDevice.getInstance().configure(options)
}
