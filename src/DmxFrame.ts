import type { Mergeable } from './Mergeable'

/**
 * A class representing a single DMX frame: DMX channels and their values.
 */
export class DmxFrame implements Mergeable<DmxFrame> {
  /**
   * DMX channel values (0-indexed array). Undefined values indicate unset channels.
   */
  data: (number | undefined)[] = []

  /**
   * Returns DMX channel value. 1-based index.
   * @param channel DMX channel index
   * @returns DMX channel value
   * @example
   * frame.get(1) // get channel 1
   */
  get(channel: number): number | undefined {
    if (channel <= 0 || 512 < channel) {
      throw new Error(
        `[DmxFrame] Cannot access outside of DMX channels: ${channel}`
      )
    }
    return this.data[channel - 1] // data is 0-indexed, channel is 1-indexed
  }

  /**
   * Returns DMX channel value or 0.
   * @example
   * frame.getValue(1) // get channel 1
   */
  getValue(channel: number): number {
    return this.get(channel) || 0
  }

  /**
   * Set DMX channel value. 1-based index. If length of array exceeds bounds, the remaining values are ignored.
   *
   * @example
   * frame.set(1, 255) // set channel 1 = 255
   * frame.set(1, [255, 255]) // set channel 1 = 255 and channel 2 = 255
   * frame.set(1, undefined) // unset channel 1
   * frame.set([255, 255]) // set channel 1 = 255 and channel 2 = 255
   */
  set(
    channel: number,
    value: number | undefined | (number | undefined)[]
  ): DmxFrame
  set(value: number | (number | undefined)[]): DmxFrame
  set(
    channelOrValue: number | (number | undefined)[],
    value?: number | undefined | (number | undefined)[]
  ): DmxFrame {
    if (Array.isArray(channelOrValue)) {
      value = channelOrValue
      channelOrValue = 1
    }

    const channel = channelOrValue
    if (channel <= 0 || 512 < channel) {
      throw new Error(
        `[DmxFrame] Cannot set value to outside of DMX channels: ${channel}`
      )
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const targetCh = channel + i
        if (targetCh <= 512) {
          this.set(targetCh, value[i])
        }
      }
    } else {
      if (typeof value === 'number') {
        value = Math.max(Math.min(value, 255), 0)
        this.data[channel - 1] = value
      } else {
        this.data[channel - 1] = undefined
      }
    }

    return this
  }

  /**
   * Add each channel value of the source to this frame. Undefined channels in the source will be untouched.
   * @param source DmxFrame to be added
   * @returns This frame
   */
  add(source: DmxFrame): DmxFrame {
    for (let i = 0; i < 512; i++) {
      const currentValue = this.data[i]
      const targetValue = source.data[i]
      if (targetValue === undefined) continue
      this.data[i] = Math.min(255, (currentValue ?? 0) + targetValue)
    }
    return this
  }

  /**
   * Scale values by a factor. Undefined channels will be untouched.
   * @param scale Scaling factor
   * @returns This frame
   */
  scale(scale: number): DmxFrame {
    for (let i = 0; i < 512; i++) {
      const currentValue = this.data[i]
      if (currentValue === undefined) continue
      this.data[i] = Math.min(255, currentValue * scale)
    }
    return this
  }

  /**
   * Overwrite values with ones of another DmxFrame. Undefined channels in the source will be untouched.
   * @param source DmxFrame to be merged
   * @returns This frame
   */
  merge(source: DmxFrame): DmxFrame {
    for (let i = 0; i < 512; i++) {
      const targetValue = source.data[i]
      if (targetValue === undefined) continue
      this.data[i] = targetValue
    }
    return this
  }

  /**
   * Create a copy of this frame.
   * @returns A new DmxFrame with the same values
   */
  clone(): DmxFrame {
    const ret = new DmxFrame()
    ret.data = [...this.data]
    return ret
  }

  /**
   * Copy values from another DmxFrame.
   * @param source DmxFrame to be copied
   * @returns This frame
   */
  copy(source: DmxFrame): DmxFrame {
    this.data = [...source.data]
    return this
  }

  /**
   * Make a transition to another DmxFrame.
   * @param target DmxFrame to transition to
   * @param progress Transition progress (0-1)
   * @returns This frame
   */
  transitionTo(target: DmxFrame, progress: number): DmxFrame {
    for (let i = 0; i < 512; i++) {
      const targetVal = target.data[i]
      if (targetVal !== undefined) {
        const currentVal = this.data[i] || 0
        this.data[i] = progress * targetVal + (1 - progress) * currentVal
      }
    }
    return this
  }
}
