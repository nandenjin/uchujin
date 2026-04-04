import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'artnet/index': 'src/artnet/index.ts',
    'ftdi/index': 'src/ftdi/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  external: ['ftdi-d2xx'],
  clean: true,
})
