# uchujin

[![npm version](https://img.shields.io/npm/v/uchujin?style=flat-square)](https://www.npmjs.com/package/uchujin)
[![license](https://img.shields.io/npm/l/uchujin?style=flat-square)](https://www.npmjs.com/package/uchujin)
[![CI](https://img.shields.io/github/actions/workflow/status/nandenjin/uchujin/checks.yaml?style=flat-square)](https://github.com/nandenjin/uchujin/actions/workflows/checks.yaml)

JavaScript/TypeScript library for DMX lighting control. Extracted from real-world lighting solutions and installation artworks — designed to work across browser and Node.js environments, with a focus on modern syntax and minimal boilerplate.

## Features

| Feature | Browser | Node.js |
|---------|:-------:|:-------:|
| `DmxFrame` — DMX channel data and manipulation | ✓ | ✓ |
| Art-Net transmitter & receiver | — | ✓ |
| FTDI USB DMX transmitter | — | ✓ |

## Installation

```sh
npm install uchujin
```

### Entry points

| Import | Contents |
|--------|----------|
| `uchujin` | `DmxFrame`, `Mergeable` |
| `uchujin/artnet` | Art-Net transmitter and receiver |
| `uchujin/ftdi` | FTDI USB transmitter |

### FTDI

The FTDI transmitter depends on `ftdi-d2xx`, which is an optional dependency and must be installed explicitly:

```sh
npm install ftdi-d2xx
```

## License

MIT © [Kazumi Inada](https://nandenjin.com)
