import { DmxFrame } from '../DmxFrame'
import { ArtNetDevice } from './ArtNetDevice'
import { ArtNetOpcode, ARTNET_HEADER } from './protocol'

export interface ArtNetTransmitterOptions {
  /**
   * Destination IP address
   * @default "255.255.255.255"
   */
  host?: string
  /**
   * Destination Port
   * @default 6454
   */
  port?: number

  /**
   * Net address of the transmitter
   * @default 0
   */
  net?: number
  /**
   * Subnet address of the transmitter
   * @default 0
   */
  subnet?: number
  /**
   * Universe address of the transmitter
   * @default 0
   */
  universe?: number

  /**
   * Local interface to bind to
   */
  bindHost?: string

  /**
   * Transmission FPS (Frames Per Second)
   * @default 44
   */
  fps?: number
}

/**
 * ArtNetTransmitter
 * Sends DMX data via ArtNetDevice
 */
export class ArtNetTransmitter {
  net: number = 0
  subnet: number = 0
  universe: number = 0

  host: string = '255.255.255.255'
  port: number = 6454

  /**
   * Internal DMX buffer
   */
  readonly buffer: DmxFrame = new DmxFrame()

  private socketKey: string | null = null
  private isConnected: boolean = false
  private interval: NodeJS.Timeout | null = null
  private fps: number = 44

  constructor(options?: ArtNetTransmitterOptions) {
    if (options) {
      this.configure(options)
    }
  }

  configure(options: ArtNetTransmitterOptions) {
    this.net = options.net ?? this.net
    this.subnet = options.subnet ?? this.subnet
    this.universe = options.universe ?? this.universe
    this.host = options.host ?? this.host
    this.port = options.port ?? this.port
    if (options.fps !== undefined) {
      this.setFPS(options.fps)
    }
  }

  setFPS(fps: number) {
    this.fps = fps
    if (this.interval) {
      this.startTimer()
    }
  }

  getFPS(): number {
    return this.fps
  }

  private startTimer() {
    this.stopTimer()
    if (this.fps > 0) {
      const intervalMs = 1000 / this.fps
      this.interval = setInterval(() => {
        if (this.isConnected) {
          const packet = this.createBuffer()
          // Re-using sendPacket() to send current buffer
          this.sendPacket(packet)
        }
      }, intervalMs)
    }
  }

  private stopTimer() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  /**
   * Initialize the socket connection
   */
  async connect(options?: { bindHost?: string; bindPort?: number }) {
    const bindHost = options?.bindHost ?? '0.0.0.0'
    const bindPort = options?.bindPort ?? 6454

    const device = ArtNetDevice.getInstance()
    this.socketKey = await device.bind(bindHost, bindPort)
    this.isConnected = true
    this.startTimer()
  }

  /**
   * Send DMX frame
   * @param frame Optional frame to update buffer with before sending
   */
  send(frame?: DmxFrame) {
    if (frame) {
      this.buffer.copy(frame)
    }
  }

  private sendPacket(buffer: Buffer) {
    if (!this.isConnected || !this.socketKey) return
    ArtNetDevice.getInstance().send(
      this.socketKey,
      buffer,
      this.host,
      this.port
    )
  }

  private createBuffer(): Buffer {
    const length = 512
    const buffer = Buffer.alloc(18 + length)

    // Header
    buffer.write(ARTNET_HEADER, 0)
    buffer.writeUInt16LE(ArtNetOpcode.OP_DATA, 8)
    buffer.writeUInt16BE(14, 10) // Proto Version

    // Sequence (0 for now, disabling sequence checking)
    buffer.writeUInt8(0, 12)

    // Physical
    buffer.writeUInt8(0, 13)

    // Universe
    const subuni = (this.subnet << 4) | this.universe
    buffer.writeUInt8(subuni, 14)
    buffer.writeUInt8(this.net, 15)

    // Length
    buffer.writeUInt16BE(length, 16)

    // Data
    for (let i = 0; i < length; i++) {
      const val = this.buffer.data[i] ?? 0
      buffer.writeUInt8(val, 18 + i)
    }

    return buffer
  }

  close() {
    this.stopTimer()
    this.socketKey = null
    this.isConnected = false
  }
}

/**
 * Create and connect an ArtNet transmitter
 */
export async function createArtNetTransmitter(
  options?: ArtNetTransmitterOptions
): Promise<ArtNetTransmitter> {
  const transmitter = new ArtNetTransmitter(options)
  await transmitter.connect({ bindHost: options?.bindHost })
  return transmitter
}
