# [1.6.0](https://github.com/jamiebclark/stablature/compare/v1.5.2...v1.6.0) (2026-11-04)


### Features

* **playing-techniques:** playing techniques: hammer-ons, pull-offs, slides, taps and decorations ([#2](https://github.com/jamiebclark/stablature/issues/2)) ([421b130](https://github.com/jamiebclark/stablature/commit/421b1306e6f6b68db05c6ceaa944e299afbf81de))

## [1.5.2](https://github.com/jamiebclark/stablature/compare/v1.5.1...v1.5.2) (2026-11-02)


### Bug Fixes

* **capture:** rename the chord annotation to "chord symbol" ([467b4ab](https://github.com/jamiebclark/stablature/commit/467b4abbb65ad3d86ab4ac76499b41ef048ee55f))

## [1.5.1](https://github.com/jamiebclark/stablature/compare/v1.5.0...v1.5.1) (2026-11-02)


### Bug Fixes

* **capture:** carry chord tones by weight, not colour alone ([de99391](https://github.com/jamiebclark/stablature/commit/de99391d9c40724fbe565fa522c411289450dcd6))

# [1.5.0](https://github.com/jamiebclark/stablature/compare/v1.4.0...v1.5.0) (2026-11-02)


### Features

* real favicon, measured tab font, logo, and the written pages ([3b6ad5e](https://github.com/jamiebclark/stablature/commit/3b6ad5e2241828f2fa2bd9ef8e67c51745342867))

# [1.4.0](https://github.com/jamiebclark/stablature/compare/v1.3.2...v1.4.0) (2026-11-02)


### Bug Fixes

* **capture:** make chord-tone colours actually reach the neck ([81bebd1](https://github.com/jamiebclark/stablature/commit/81bebd16616ef555f0e9e58e7de5ff7f75902097))


### Features

* **capture:** show where a chord's notes fall on the neck ([5982f0b](https://github.com/jamiebclark/stablature/commit/5982f0ba40d6c9ff05b568bce9a04c9b76d88278))
* **chords:** read chord symbols as notes ([6d62315](https://github.com/jamiebclark/stablature/commit/6d62315f99881988aebb28ea71d320c1f8a0ad53))

## [1.3.2](https://github.com/jamiebclark/stablature/compare/v1.3.1...v1.3.2) (2026-11-02)


### Bug Fixes

* **capture:** make the fretboard readable in light mode ([2623691](https://github.com/jamiebclark/stablature/commit/26236911fc6d2ac610efccef54fcb86e5b4e6fa1))

## [1.3.1](https://github.com/jamiebclark/stablature/compare/v1.3.0...v1.3.1) (2026-11-02)


### Bug Fixes

* **capture:** make the selection visible, and stop the suite testing stale builds ([ff2ddcd](https://github.com/jamiebclark/stablature/commit/ff2ddcdc9ea90b3e5692fde08fd6e472aa3f91e9))

# [1.3.0](https://github.com/jamiebclark/stablature/compare/v1.2.0...v1.3.0) (2026-11-02)


### Features

* **capture:** add select, cut, copy and paste, and an icon pass ([5953d75](https://github.com/jamiebclark/stablature/commit/5953d7575cd705b36035fad6303f2fbf411130e3)), closes [#26200f](https://github.com/jamiebclark/stablature/issues/26200f)

# [1.2.0](https://github.com/jamiebclark/stablature/compare/v1.1.1...v1.2.0) (2026-11-02)


### Features

* **capture:** add a space column, an insertion caret and neck highlighting ([f006ae5](https://github.com/jamiebclark/stablature/commit/f006ae50991d02b306156e57724b0dfb80195709))

## [1.1.1](https://github.com/jamiebclark/stablature/compare/v1.1.0...v1.1.1) (2026-11-02)


### Bug Fixes

* **capture:** keep stack mode armed so chords take one toggle ([53b9055](https://github.com/jamiebclark/stablature/commit/53b90551ad8fe13f98135bad613ed6008548ec1e))

# [1.1.0](https://github.com/jamiebclark/stablature/compare/v1.0.0...v1.1.0) (2026-11-02)


### Features

* **capture:** add an insertion cursor, and fix what looking at it exposed ([a96a2ae](https://github.com/jamiebclark/stablature/commit/a96a2aeb420959aa49a5c84f7b7fffa55e1f23c1))

# 1.0.0 (2026-11-02)


### Features

* **app:** add band, song, arrangement and play views ([f17457a](https://github.com/jamiebclark/stablature/commit/f17457a90cc3cec0c22f793e2caf39154c8805e7))
* **arrangement:** add arrangement expansion and editing ([62e2550](https://github.com/jamiebclark/stablature/commit/62e2550da6a4a758464409e2f62e6f61ddafb04b))
* **capture:** add editing operations for parts, repeats, triplets and chords ([8b33463](https://github.com/jamiebclark/stablature/commit/8b33463d51be5889c0cd05202987fc76999c26c0))
* **core:** add hybrid logical clocks, fractional ranks and client ids ([e597743](https://github.com/jamiebclark/stablature/commit/e59774353e5b0159387452fad40e1b6e0ef3e000))
* **db:** add sync-ready Postgres schema with Better Auth ([165fdd2](https://github.com/jamiebclark/stablature/commit/165fdd2cb00e0d7e90404f81ef09522cff99094a))
* **local:** add offline-first Dexie mirror and atomic write path ([59a7f1a](https://github.com/jamiebclark/stablature/commit/59a7f1ae135d8beb940369573060c937ce83eed0))
* **music:** add pitch arithmetic and bass tuning presets ([02d8b53](https://github.com/jamiebclark/stablature/commit/02d8b5308090995d233c5675b74ee8dbbe623a22))
* **pwa:** add installable offline shell, icons and text export ([78d2bc5](https://github.com/jamiebclark/stablature/commit/78d2bc5db7ec2d1dddf19b30d81fa2b2c06e892e))
* **sync:** add field-level last-write-wins merge ([69af720](https://github.com/jamiebclark/stablature/commit/69af720470974d4a75452598cb556af47ad8f933))
* **sync:** add push/pull/stream endpoints and the client sync engine ([506a676](https://github.com/jamiebclark/stablature/commit/506a676111f440f982c3064df34a6b4b7aeea424))
* **tab:** add tab layout and ASCII rendering ([3b59399](https://github.com/jamiebclark/stablature/commit/3b59399c3494179be776138f8892910d4ff9e313))
* **ui:** add tab staff, fretboard and capture screen ([776b32a](https://github.com/jamiebclark/stablature/commit/776b32a79fc7d141e9cfb4b6da812d0df6bc28d1))
