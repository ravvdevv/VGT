# Vanguard Terminal (VGT)

VGT is a fast, lightweight terminal interface for talking to your locally running Ollama AI models.

## Purpose

Standard AI chats can feel heavy or laggy. VGT is built to be extremely fast and light. It strips away all unnecessary overhead to give you an instant, smooth text streaming experience directly inside your terminal, even on older or slower laptops.

## How It Works

- **Instant Start**: Bypasses background initialization pauses so the shell opens immediately.
- **Buttery-Smooth Streaming**: Reads incoming text using highly optimized parsing to prevent lag.
- **Smart Memory Preservation**: Keeps your conversation history clean and handles connection drops or cancellations without losing context.
- **Fast Mode Switching**: Quickly switch between operating modes like security, general assistance, or first-principles learning.

## Prerequisites

- **Bun Runtime**: v1.0.0 or higher.
- **Ollama**: Installed and running locally on your computer.

## Quick Start

1. Install project files:
   ```powershell
   bun install
   ```

2. Build the optimized launcher:
   ```powershell
   bun run build
   ```

3. Start VGT:
   ```powershell
   .\vgt.exe
   ```

## Options

You can launch VGT with special settings directly:
- `--mode <name>`: Starts with a specific mode (general, security, feynman, caveman).
- `--model <name>`: Starts with a specific model installed in Ollama.
