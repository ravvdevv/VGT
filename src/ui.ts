export const COLOR = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  SLATE: '\x1b[38;5;244m',
  DARK_SLATE: '\x1b[38;5;238m',
  CYAN: '\x1b[38;5;38m',
  EMERALD: '\x1b[38;5;120m',
  CRIMSON: '\x1b[38;5;196m',
  GOLD: '\x1b[38;5;222m',
  WHITE: '\x1b[38;5;255m',
};

export const UI = {
  drawDivider(char = '─', color = COLOR.DARK_SLATE): void {
    const width = Math.min(process.stdout.columns || 80, 80);
    console.log(color + char.repeat(width) + COLOR.RESET);
  },

  clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  },

  drawHeader(model: string, modeName: string, badge: string): void {
    const termWidth = Math.min(process.stdout.columns || 80, 80);
    console.log();
    console.log(` ${COLOR.BOLD}${COLOR.WHITE}VANGUARD TERMINAL${COLOR.RESET}  ${COLOR.DARK_SLATE}//${COLOR.RESET}  ${COLOR.SLATE}Model: ${COLOR.CYAN}${model}${COLOR.RESET}  ${COLOR.DARK_SLATE}|${COLOR.RESET}  ${COLOR.SLATE}Mode: ${badge} ${COLOR.SLATE}${modeName}${COLOR.RESET}`);
    console.log(COLOR.DARK_SLATE + '─'.repeat(termWidth) + COLOR.RESET);
  },

  drawHelpGuide(): void {
    console.log(
      `  ${COLOR.SLATE}Submit: ${COLOR.WHITE}Enter${COLOR.SLATE}  ${COLOR.DARK_SLATE}|${COLOR.RESET}  ${COLOR.SLATE}Menu: ${COLOR.CYAN}/help${COLOR.SLATE}  ${COLOR.DARK_SLATE}|${COLOR.RESET}  ${COLOR.SLATE}Exit: ${COLOR.CRIMSON}/exit${COLOR.RESET}\n`
    );
  },

  drawBox(title: string, lines: string[], borderColors = COLOR.DARK_SLATE): void {
    const termWidth = Math.min(process.stdout.columns || 80, 80);
    const boxWidth = termWidth - 2;

    console.log(borderColors + '┌── ' + COLOR.WHITE + COLOR.BOLD + title + ' ' + borderColors + '─'.repeat(Math.max(0, boxWidth - title.length - 5)) + '┐' + COLOR.RESET);
    for (const line of lines) {
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      const padding = ' '.repeat(Math.max(0, boxWidth - plainLine.length));
      console.log(borderColors + '│ ' + COLOR.RESET + line + padding.slice(1) + borderColors + '│' + COLOR.RESET);
    }
    console.log(borderColors + '└' + '─'.repeat(boxWidth) + '┘' + COLOR.RESET);
  }
};

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

const isPrefixOf = (str: string, target: string): boolean => {
  return target.startsWith(str);
};

const LINE_NUM_CACHE: string[] = [];
for (let i = 0; i <= 100; i++) {
  LINE_NUM_CACHE[i] = String(i).padStart(3, ' ');
}

const GUTTER_PREFIX = COLOR.DARK_SLATE + '│ ' + COLOR.SLATE;
const GUTTER_SUFFIX = ' │ ' + COLOR.GOLD;

const OPENING_FRAME = '\n' + COLOR.DARK_SLATE + '┌── CODE BLOCK ────────────────────────────────────────────────────────' + COLOR.RESET + '\n';
const CLOSING_FRAME = '\r' + COLOR.DARK_SLATE + '└──────────────────────────────────────────────────────────────────────' + COLOR.RESET + '\n';

const DASHES_80 = '─'.repeat(80);

const BASE_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PRECOMPILED_SPINNER_FRAMES = BASE_SPINNER_FRAMES.map(f => `\r${COLOR.CYAN}${f}${COLOR.RESET} ${COLOR.SLATE}Vanguard thinking...${COLOR.RESET}`);

export class StreamRenderer {
  private inCodeBlock = false;
  private backtickCount = 0;
  private lineNumber = 1;
  private isStartOfLine = true;
  private capturingLanguage = false;
  private languageBuffer = '';
  
  private inThinkingBlock = false;
  private tagBuffer = '';
  private onFirstVisibleChar: (() => void) | null = null;
  private outputBuffer = '';

  constructor(onFirstVisibleChar?: () => void) {
    this.onFirstVisibleChar = onFirstVisibleChar || null;
  }

  private bufferOutput(str: string): void {
    this.outputBuffer += str;
  }

  private flushOutput(): void {
    if (this.outputBuffer) {
      process.stdout.write(this.outputBuffer);
      this.outputBuffer = '';
    }
  }

  private triggerFirstVisibleChar(): void {
    this.onFirstVisibleChar!();
    this.onFirstVisibleChar = null;
  }

  private flushTagBuffer(): void {
    const chars = this.tagBuffer;
    this.tagBuffer = '';
    if (this.onFirstVisibleChar) this.triggerFirstVisibleChar();
    for (let i = 0; i < chars.length; i++) {
      this.bufferOutput(chars[i]!);
    }
  }

  writeToken(token: string): void {
    this.outputBuffer = '';

    if (this.inThinkingBlock && this.tagBuffer === '') {
      if (!token.includes('<') && !token.includes('/') && !token.includes('>')) {
        return;
      }
    }

    if (
      !this.inCodeBlock &&
      !this.inThinkingBlock &&
      this.tagBuffer === '' &&
      this.backtickCount === 0 &&
      !token.includes('<') &&
      !token.includes('`')
    ) {
      if (this.onFirstVisibleChar) this.triggerFirstVisibleChar();
      this.bufferOutput(token);
      this.flushOutput();
      return;
    }

    for (let i = 0; i < token.length; i++) {
      const char = token[i]!;

      if (char === '<' && !this.inCodeBlock && this.tagBuffer === '') {
        this.tagBuffer = '<';
        continue;
      }

      if (this.tagBuffer !== '') {
        this.tagBuffer += char;
        if (this.tagBuffer === THINK_OPEN) {
          this.inThinkingBlock = true;
          this.tagBuffer = '';
          continue;
        }
        if (this.tagBuffer === THINK_CLOSE) {
          this.inThinkingBlock = false;
          this.tagBuffer = '';
          continue;
        }

        if (isPrefixOf(this.tagBuffer, THINK_OPEN) || isPrefixOf(this.tagBuffer, THINK_CLOSE)) {
          continue;
        }

        this.flushTagBuffer();
        continue;
      }

      if (this.inThinkingBlock) {
        continue;
      }

      if (char === '`') {
        this.backtickCount++;
        if (this.backtickCount === 3) {
          this.inCodeBlock = !this.inCodeBlock;
          this.backtickCount = 0;
          
          if (this.onFirstVisibleChar) this.triggerFirstVisibleChar();
          if (this.inCodeBlock) {
            this.lineNumber = 1;
            this.isStartOfLine = true;
            this.capturingLanguage = true;
            this.languageBuffer = '';
            this.bufferOutput(OPENING_FRAME);
          } else {
            this.bufferOutput(CLOSING_FRAME);
          }
          continue;
        }
        continue;
      } else {
        if (this.backtickCount > 0) {
          const backticks = '`'.repeat(this.backtickCount);
          this.backtickCount = 0;
          
          if (this.onFirstVisibleChar) this.triggerFirstVisibleChar();
          for (let b = 0; b < backticks.length; b++) {
            if (this.inCodeBlock) {
              this.printChar(backticks[b]!);
            } else {
              this.bufferOutput(backticks[b]!);
            }
          }
        }
      }

      if (this.capturingLanguage) {
        if (char === '\n') {
          this.capturingLanguage = false;
          if (this.languageBuffer.trim()) {
            const lang = this.languageBuffer.trim().toUpperCase();
            this.bufferOutput('\r\x1b[A\x1b[K');
            const padLen = Math.max(0, 66 - lang.length);
            this.bufferOutput(COLOR.DARK_SLATE + '┌── ' + COLOR.WHITE + COLOR.BOLD + lang + COLOR.DARK_SLATE + ' ' + DASHES_80.slice(0, padLen) + COLOR.RESET + '\n');
          }
          this.isStartOfLine = true;
        } else {
          this.languageBuffer += char;
        }
        continue;
      }

      if (this.onFirstVisibleChar) this.triggerFirstVisibleChar();
      if (this.inCodeBlock) {
        this.printChar(char);
      } else {
        this.bufferOutput(char);
      }
    }

    this.flushOutput();
  }

  private printChar(char: string): void {
    if (this.inCodeBlock) {
      if (this.isStartOfLine) {
        const numStr = this.lineNumber <= 100 ? LINE_NUM_CACHE[this.lineNumber]! : String(this.lineNumber).padStart(3, ' ');
        this.bufferOutput(GUTTER_PREFIX + numStr + GUTTER_SUFFIX);
        this.isStartOfLine = false;
      }

      this.bufferOutput(char);

      if (char === '\n') {
        this.bufferOutput(COLOR.RESET);
        this.lineNumber++;
        this.isStartOfLine = true;
      }
    } else {
      this.bufferOutput(char);
    }
  }

  reset(onFirstVisibleChar?: () => void): void {
    this.inCodeBlock = false;
    this.backtickCount = 0;
    this.lineNumber = 1;
    this.isStartOfLine = true;
    this.capturingLanguage = false;
    this.languageBuffer = '';
    this.inThinkingBlock = false;
    this.tagBuffer = '';
    this.onFirstVisibleChar = onFirstVisibleChar || null;
    this.outputBuffer = '';
    process.stdout.write(COLOR.RESET);
  }
}

export class TerminalSpinner {
  private frames: string[] = PRECOMPILED_SPINNER_FRAMES;
  private currentFrame = 0;
  private intervalId: Timer | null = null;

  constructor() {
  }

  start(): void {
    if (this.intervalId) return;

    process.stdout.write('\x1b[?25l');

    this.intervalId = setInterval(() => {
      process.stdout.write(this.frames[this.currentFrame]!);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  stop(): void {
    if (!this.intervalId) return;

    clearInterval(this.intervalId);
    this.intervalId = null;

    process.stdout.write('\r\x1b[K');
    process.stdout.write('\x1b[?25h');
  }
}
