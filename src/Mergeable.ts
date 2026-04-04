export interface Mergeable<T> {
  add: (src: T) => T
  scale: (scale: number) => T
  merge: (src: T) => T
}
