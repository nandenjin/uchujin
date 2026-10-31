import { DmxFrame } from '../DmxFrame'
// ftdi-d2xx is a native CommonJS addon: Node's ESM loader cannot detect its named
// exports, so it has to be imported as default.
import ftdi from 'ftdi-d2xx'
import type { FTDI_Device, FTDI_DeviceInfo } from 'ftdi-d2xx'

// D2XX constants. ftdi-d2xx declares these in its typings but does not export them at runtime.
const FT_BITS_8 = 8
const FT_STOP_BITS_2 = 2
const FT_PARITY_NONE = 0
const FT_FLOW_NONE = 0x0000
const FT_PURGE_RX = 1
const FT_PURGE_TX = 2

/**
 * Minimum frame period. 513 slots at 250kbps (11 bits each) take ~22.6ms;
 * starting the next break earlier would cut off the tail of the frame.
 */
const MIN_FRAME_MS = 25

export type FtdiDeviceInfo = FTDI_DeviceInfo

export interface FtdiTransmitterOptions {
  /**
   * Transmission FPS (Frames Per Second). Capped at 40 so that a full frame always completes.
   * @default 30
   */
  fps?: number
  /**
   * Specific device to connect to
   */
  deviceInfo?: FtdiDeviceInfo
  /**
   * Called when the device fails during transmission (e.g. the adapter is unplugged).
   * Transmission stops and the device is closed; call `connect()` again to resume.
   */
  onError?: (error: unknown) => void
}

/**
 * Send DMX data via FTDI USB
 */
export class FtdiTransmitter {
  private device: FTDI_Device | null = null
  /**
   * Internal DMX buffer
   */
  readonly buffer: DmxFrame = new DmxFrame()
  private isRunning: boolean = false
  private fps: number = 30
  private deviceInfo?: FtdiDeviceInfo
  private onError?: (error: unknown) => void

  constructor(options?: FtdiTransmitterOptions) {
    if (options?.fps) {
      this.fps = options.fps
    }
    if (options?.deviceInfo) {
      this.deviceInfo = options.deviceInfo
    }
    this.onError = options?.onError
  }

  /**
   * Connect to an FTDI device
   */
  async connect(deviceInfo?: FtdiDeviceInfo) {
    this.deviceInfo = deviceInfo ?? this.deviceInfo
    if (!this.deviceInfo) {
      throw new Error('Device not specified')
    }

    const device = await ftdi.openDevice(this.deviceInfo)
    // Same init sequence as ENTTEC Open DMX USB. Clearing RTS enables the RS485 line driver
    // on many FTDI-based DMX adapters; without it nothing reaches the fixtures.
    device.resetDevice()
    device.setBaudRate(250000)
    device.setDataCharacteristics(FT_BITS_8, FT_STOP_BITS_2, FT_PARITY_NONE)
    device.setFlowControl(FT_FLOW_NONE, 0, 0)
    device.clrRts()
    device.purge(FT_PURGE_TX | FT_PURGE_RX)
    this.device = device

    this.isRunning = true
    this.startTransmissionLoop()
  }

  private async startTransmissionLoop() {
    const data = new Uint8Array(513)
    data[0] = 0x00 // Start code

    while (this.isRunning && this.device) {
      const { device } = this
      const startedAt = performance.now()

      try {
        // Break + MAB
        device.setBreakOn()
        await delay(1)
        device.setBreakOff()

        // Data
        for (let i = 0; i < 512; i++) {
          data[i + 1] = this.buffer.data[i] ?? 0
        }
        await device.write(data)
      } catch (error) {
        if (!this.isRunning) return // closed during transmission
        await this.close().catch(() => {})
        if (this.onError) {
          this.onError(error)
          return
        }
        throw error
      }

      // FPS wait
      const periodMs = Math.max(1000 / this.fps, MIN_FRAME_MS)
      await delay(periodMs - (performance.now() - startedAt))
    }
  }

  /**
   * Send DMX frame (update buffer)
   * @param frame Optional frame to update buffer with
   */
  send(frame?: DmxFrame) {
    if (frame) {
      this.buffer.copy(frame)
    }
  }

  async close() {
    this.isRunning = false
    const { device } = this
    this.device = null
    if (device) {
      await device.close()
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}

/**
 * List connected FTDI devices
 */
export async function listFtdiDevices() {
  return await ftdi.getDeviceInfoList()
}

export async function getFtdiDeviceInfo(serialNumber: string) {
  const devices = await listFtdiDevices()
  return devices.find((d) => d.serial_number === serialNumber)
}

/**
 * Create and connect an FTDI transmitter
 */
export async function createFtdiTransmitter(
  options?: FtdiTransmitterOptions
): Promise<FtdiTransmitter> {
  if (!options?.deviceInfo) {
    const deviceInfo = await listFtdiDevices()
    if (deviceInfo.length === 0) {
      throw new Error('No FTDI devices found')
    }
    options = { ...options, deviceInfo: deviceInfo[0] }
  }
  const transmitter = new FtdiTransmitter(options)
  await transmitter.connect()
  return transmitter
}
