import { DmxFrame } from '../DmxFrame'
import {
  FT_BITS_8,
  FT_PARITY_NONE,
  FT_PURGE_TX,
  FT_STOP_BITS_2,
  FTDI_Device,
  FTDI_DeviceInfo,
  getDeviceInfoList,
  openDevice,
} from 'ftdi-d2xx'

export type FtdiDeviceInfo = FTDI_DeviceInfo

export interface FtdiTransmitterOptions {
  /**
   * Transmission FPS (Frames Per Second)
   * @default 44
   */
  fps?: number
  /**
   * Specific device to connect to
   */
  deviceInfo?: FtdiDeviceInfo
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
  private fps: number = 44
  private deviceInfo?: FtdiDeviceInfo

  constructor(options?: FtdiTransmitterOptions) {
    if (options?.fps) {
      this.fps = options.fps
    }
    if (options?.deviceInfo) {
      this.deviceInfo = options.deviceInfo
    }
  }

  /**
   * Connect to an FTDI device
   */
  async connect(deviceInfo?: FtdiDeviceInfo) {
    this.deviceInfo = deviceInfo ?? this.deviceInfo
    if (!this.deviceInfo) {
      throw new Error('Device not specified')
    }

    this.device = await openDevice(this.deviceInfo)
    this.device.setDataCharacteristics(
      FT_BITS_8,
      FT_STOP_BITS_2,
      FT_PARITY_NONE
    )

    this.isRunning = true
    this.startTransmissionLoop()
  }

  private async startTransmissionLoop() {
    if (!this.device) return

    const { device } = this

    while (this.isRunning && this.device) {
      // Clear TX buffer
      device.purge(FT_PURGE_TX)

      // Break
      device.setBaudRate(90000)
      await device.write(Uint8Array.from([0]))

      // Start code
      device.setBaudRate(250000)
      const data = new Uint8Array(513)
      data[0] = 0x00

      // Data
      for (let i = 0; i < 512; i++) {
        data[i + 1] = this.buffer.data[i] ?? 0
      }

      // Send packet
      await device.write(data)

      // FPS wait
      const delayMs = 1000 / this.fps
      await delay(delayMs)
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
    if (this.device) {
      await this.device.close()
      this.device = null
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * List connected FTDI devices
 */
export async function listFtdiDevices() {
  return await getDeviceInfoList()
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
