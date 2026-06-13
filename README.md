# AuraTranslate

![AuraTranslate Hero Banner](src/assets/hero.png)

A sleek, premium command-palette style desktop translator built with Electron, React, and Vite. Designed for speed, convenience, and customizability.

## Features

- **Command Palette Layout**: Lightweight, borderless translucent interface that stays out of your way.
- **Global Toggle Hotkey**: Show or hide the app instantly using a custom keyboard shortcut (defaults to `Ctrl+Shift+Space`).
- **Flexible Status Footer**:
  - Automatically collapses and hides. Hover your mouse over the bottom window border to reveal it.
  - Quick access to active shortcuts, settings, and status indicators.
  - Can be toggled to fixed visibility or hidden entirely in Settings.
- **Multiple Translation Providers**:
  - **Google Translate**: Built-in free web translation (default, keyless).
  - **Google Apps Script**: Connect to your own Google Apps Script deployment URL.
  - **Gemini API**: Harness Google's Gemini models for premium AI translations.
- **Premium Themes**: Choose between Dark, Light, and macOS Frosted Glass styling with dynamic border colors.
- **Text-to-Speech (TTS)**: Listen to both the source text and the translated output.
- **Convenient Controls**: Customize window behavior, hide-on-blur (clicking outside), and toggle automatically launching on Windows startup.

## Keyboard Shortcuts

- **Ctrl + K**: Open the action command menu.
- **Ctrl + ,**: Open Settings.
- **Ctrl + Enter**: Copy translation to clipboard.
- **Alt + S**: Swap languages.
- **Alt + I**: Listen to source text.
- **Alt + O**: Listen to translated output.
- **Escape**: Clear input text / Close panels.

## Setup & Development

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Run Locally (Development)

To launch the app in development mode with hot-reloading:

```bash
npm run dev
```

### Build & Package Standalone App

To build the client assets and compile the standalone Windows portable executable:

```bash
npm run package
```

The output will be written to the `dist/` directory as a compact standalone executable (approx. 90MB) that launches instantly.

## License

MIT License.
