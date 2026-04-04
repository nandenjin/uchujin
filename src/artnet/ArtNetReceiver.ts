import { EventEmitter } from 'node:events'
import { DmxFrame } from '../DmxFrame'
import { ArtNetDevice } from './ArtNetDevice'

export interface ArtNetReceiverOptions {
  /**
   * Net address of the receiver
   * @default 0
   */
  net?: number
  /**
   * Subnet address of the receiver
   * @default 0
   */
  subnet?: number
  /**
   * Universe address of the receiver
   * @default 0
   */
  universe?: number
}

export interface ArtNetReceiverConnectOptions extends ArtNetReceiverOptions {
  bindHost?: string
  port?: number
}

interface ArtNetReceiverEvents {
  update: () => void
  error: (error: Error) => void
}

/**
 * ArtNetReceiver
 * Receives DMX data from ArtNetDevice for a specific universe.
 */
export class ArtNetReceiver extends EventEmitter {
  net: number = 0
  subnet: number = 0
  universe: number = 0

  /**
   * DMX data buffer
   */
  readonly buffer: DmxFrame = new DmxFrame()

  private socketKey: string | null = null
  private isConnected: boolean = false

  constructor(options?: ArtNetReceiverOptions) {
    super()
    if (options) {
      this.net = options.net ?? 0
      this.subnet = options.subnet ?? 0
      this.universe = options.universe ?? 0
    }
  }

  /**
   * Connect to ArtNet receiver. If already connected, disconnects first.
   * @param options ArtNet receiver options
   */
  async connect(options: ArtNetReceiverConnectOptions): Promise<void> {
    if (this.isConnected) {
      this.close() // Unregister first
    }

    this.net = options.net ?? this.net ?? 0
    this.subnet = options.subnet ?? this.subnet ?? 0
    this.universe = options.universe ?? this.universe ?? 0

    const host = options.bindHost ?? '0.0.0.0'
    const port = options.port ?? 6454

    try {
      const device = ArtNetDevice.getInstance()
      this.socketKey = await device.bind(host, port)
      device.registerReceiver(this.socketKey, this)
      this.isConnected = true
    } catch (error) {
      this.emit('error', error as Error)
      throw error
    }
  }

  /**
   * Called by ArtNetDevice when data is received.
   * @internal
   */
  handleDmxData(data: Buffer) {
    // Convert Buffer to number[] for DmxFrame
    const values = Array.from(data)
    this.buffer.set(values)
    this.emit('update')
  }

  on<K extends keyof ArtNetReceiverEvents>(
    eventName: K,
    listener: ArtNetReceiverEvents[K]
  ): this {
    return super.on(eventName, listener)
  }

  once<K extends keyof ArtNetReceiverEvents>(
    eventName: K,
    listener: ArtNetReceiverEvents[K]
  ): this {
    return super.once(eventName, listener)
  }

  emit<K extends keyof ArtNetReceiverEvents>(
    eventName: K,
    ...args: Parameters<ArtNetReceiverEvents[K]>
  ): boolean {
    return super.emit(eventName as string, ...args)
  }

  off<K extends keyof ArtNetReceiverEvents>(
    eventName: K,
    listener: ArtNetReceiverEvents[K]
  ): this {
    return super.off(eventName, listener)
  }

  close() {
    if (this.socketKey && this.isConnected) {
      ArtNetDevice.getInstance().unregisterReceiver(this.socketKey, this)
      this.isConnected = false
      this.socketKey = null
    }
  }
}

/**
 * Create an ArtNet receiver
 */
export async function createArtNetReceiver(
  options?: ArtNetReceiverConnectOptions
): Promise<ArtNetReceiver> {
  const receiver = new ArtNetReceiver()
  if (options) {
    await receiver.connect(options)
  }
  return receiver
}
