# Hot Tab

A browser extension to enable hotkeys for moving/pinning/closing tabs. Source code
is written in TypeScript

Available Actions:

- Pin current tab
- Move tab left
- Move tab right
- Close other tabs

## Common Build Steps

1. Install NodeJS version from .tool-versions file or use [asdf](https://github.com/asdf-vm/asdf)
1. Run `npm i -g yarn web-ext`
1. Run `yarn install`

## Debugging

1. In one terminal run `yarn watch`
1. In another terminal run `web-ext run`

## Packaging

1. Run `yarn package`

## Operating Systems

This has been built on macOS. I have not tried any other operating systems.

## License

MIT

