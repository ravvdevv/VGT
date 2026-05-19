import { createInterface } from 'readline';
import { OllamaClient } from './client';
import { SessionHistory } from './history';
import { MODES, type OperatingMode } from './prompt';
import { COLOR, UI, StreamRenderer, TerminalSpinner } from './ui';

const PROMPT_CACHE: Record<OperatingMode, string> = {
  GENERAL: `${COLOR.BOLD}${COLOR.CYAN}vgt${COLOR.RESET} ${COLOR.SLATE}[general]${COLOR.RESET} > `,
  SECURITY: `${COLOR.BOLD}${COLOR.CRIMSON}vgt${COLOR.RESET} ${COLOR.SLATE}[security]${COLOR.RESET} > `,
  FEYNMAN: `${COLOR.BOLD}${COLOR.EMERALD}vgt${COLOR.RESET} ${COLOR.SLATE}[feynman]${COLOR.RESET} > `,
  CAVEMAN: `${COLOR.BOLD}${COLOR.CYAN}vgt${COLOR.RESET} ${COLOR.SLATE}[caveman]${COLOR.RESET} > `,
};

export class InteractiveShell {
  private client: OllamaClient;
  private history: SessionHistory;
  private renderer: StreamRenderer;
  private spinner: TerminalSpinner;
  private currentMode: OperatingMode = 'GENERAL';
  private currentModel = 'qwen2.5-coder:1.5b-instruct-q2_K';
  private availableModels: string[] = [];
  private isGenerating = false;
  private abortController: AbortController | null = null;
  private modelsPromise: Promise<void> | null = null;

  constructor(client: OllamaClient, history: SessionHistory) {
    this.client = client;
    this.history = history;
    this.renderer = new StreamRenderer();
    this.spinner = new TerminalSpinner();
  }

  async start(): Promise<void> {
    this.modelsPromise = this.client.listModels()
      .then((models) => {
        this.availableModels = models.map((m) => m.name);
        if (this.availableModels.length > 0) {
          if (!this.availableModels.includes(this.currentModel)) {
            const preferred = this.availableModels.find((m) =>
              m.includes('llama3') || m.includes('qwen') || m.includes('mistral') || m.includes('codegemma')
            );
            this.currentModel = preferred || this.availableModels[0]!;
          }
        } else {
          this.currentModel = 'mock-vanguard-model';
        }
        this.modelsPromise = null;
      })
      .catch(() => {
        this.currentModel = 'mock-vanguard-model';
        this.modelsPromise = null;
      });

    this.runShellLoop();
  }

  private runShellLoop(): void {
    UI.clearScreen();
    const mode = MODES[this.currentMode];
    UI.drawHeader(this.currentModel, mode.name, mode.badge);
    UI.drawHelpGuide();

    const initialGreeting = 'Hello! How can I assist you today?';
    this.history.addMessage('assistant', initialGreeting);
    console.log(`${COLOR.CYAN}vgt [assistant] >${COLOR.RESET} ${initialGreeting}\n`);

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on('SIGINT', () => {
      if (this.isGenerating && this.abortController) {
        this.abortController.abort();
      } else {
        rl.close();
      }
    });

    const getPrompt = () => PROMPT_CACHE[this.currentMode];

    const promptUser = () => {
      rl.setPrompt(getPrompt());
      rl.prompt();
    };

    promptUser();

    rl.on('line', async (line) => {
      if (this.isGenerating) return;

      const input = line.trim();
      if (!input) {
        promptUser();
        return;
      }

      if (input.startsWith('/')) {
        await this.handleSlashCommand(input, rl);
        promptUser();
        return;
      }

      await this.generateResponse(input);
      promptUser();
    });

    rl.on('close', () => {
      this.gracefulExit();
    });
  }

  private async handleSlashCommand(input: string, rl: ReturnType<typeof createInterface>): Promise<void> {
    const parts = input.split(' ');
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    switch (command) {
      case '/exit':
        rl.close();
        break;

      case '/clear':
        this.history.clear();
        console.log(`\n ${COLOR.EMERALD}[success]${COLOR.RESET} ${COLOR.SLATE}Chat context memory wiped.${COLOR.RESET}\n`);
        break;

      case '/help':
        this.showHelp();
        break;

      case '/mode':
        if (!args) {
          console.log(`\n ${COLOR.SLATE}Current mode: ${COLOR.CYAN}${this.currentMode}${COLOR.RESET}`);
          console.log(` ${COLOR.SLATE}Available modes: ${COLOR.WHITE}general, security, feynman, caveman${COLOR.RESET}\n`);
        } else {
          const targetMode = args.toUpperCase() as OperatingMode;
          if (MODES[targetMode]) {
            this.currentMode = targetMode;
            console.log(`\n ${COLOR.EMERALD}[success]${COLOR.RESET} ${COLOR.SLATE}Switched to ${COLOR.BOLD}${MODES[targetMode].badge} ${MODES[targetMode].name}${COLOR.RESET}\n`);
            // Warmup background to prepare cache for new mode
            this.client.warmup(this.currentModel).catch(() => {});
          } else {
            console.log(`\n ${COLOR.CRIMSON}[error]${COLOR.RESET} ${COLOR.SLATE}Unknown mode "${args}". Choose from: general, security, feynman, caveman${COLOR.RESET}\n`);
          }
        }
        break;

      case '/model':
        if (this.modelsPromise) await this.modelsPromise;
        if (!args) {
          console.log(`\n ${COLOR.SLATE}Active Model: ${COLOR.CYAN}${this.currentModel}${COLOR.RESET}`);
          console.log(` ${COLOR.SLATE}Available Models on your system:${COLOR.RESET}`);
          this.availableModels.forEach((m) => console.log(`  • ${COLOR.WHITE}${m}${COLOR.RESET}`));
          console.log(`\n ${COLOR.SLATE}Change using: ${COLOR.CYAN}/model <name>${COLOR.RESET}\n`);
        } else {
          const matchedModel = this.currentModel === 'mock-vanguard-model'
            ? args
            : this.availableModels.find(
              (m) =>
                m.toLowerCase() === args.toLowerCase() ||
                m.toLowerCase() === `${args.toLowerCase()}:latest` ||
                m.toLowerCase().startsWith(args.toLowerCase())
            );

          if (matchedModel) {
            this.currentModel = matchedModel;
            console.log(`\n ${COLOR.EMERALD}[success]${COLOR.RESET} ${COLOR.SLATE}Active model changed to ${COLOR.CYAN}${matchedModel}${COLOR.RESET}\n`);
            // Trigger model load immediately
            this.client.warmup(this.currentModel).catch(() => {});
          } else {
            console.log(`\n ${COLOR.CRIMSON}[error]${COLOR.RESET} ${COLOR.SLATE}Model "${args}" not found in Ollama. Pull it first.${COLOR.RESET}\n`);
          }
        }
        break;

      case '/system':
        console.log(`\n${COLOR.DARK_SLATE}┌── ${COLOR.WHITE}Active System Prompt (${this.currentMode})${COLOR.DARK_SLATE}─┐${COLOR.RESET}`);
        MODES[this.currentMode].systemPrompt.split('\n').forEach((l) => console.log(`${COLOR.DARK_SLATE}│${COLOR.RESET} ${COLOR.SLATE}${l}${COLOR.RESET}`));
        console.log(`${COLOR.DARK_SLATE}└───────────────────────────────────┘${COLOR.RESET}\n`);
        break;

      case '/export':
        try {
          const filename = this.history.exportToMarkdown(process.cwd(), this.currentModel, this.currentMode);
          console.log(`\n ${COLOR.EMERALD}[success]${COLOR.RESET} ${COLOR.SLATE}Session exported to ${COLOR.WHITE}${filename}${COLOR.RESET}\n`);
        } catch (err) {
          console.log(`\n ${COLOR.CRIMSON}[error]${COLOR.RESET} ${COLOR.SLATE}${(err as Error).message}${COLOR.RESET}\n`);
        }
        break;

      default:
        console.log(`\n ${COLOR.CRIMSON}[error]${COLOR.RESET} ${COLOR.SLATE}Unknown command. Type ${COLOR.CYAN}/help${COLOR.SLATE} for list of commands.${COLOR.RESET}\n`);
    }
  }

  private async generateResponse(prompt: string): Promise<void> {
    if (this.modelsPromise) await this.modelsPromise;
    this.isGenerating = true;
    this.history.addMessage('user', prompt);
    this.abortController = new AbortController();

    this.spinner.start();

    let started = false;
    this.renderer.reset(() => {
      this.spinner.stop();
      console.log();
      started = true;
    });
    let assistantReply = '';

    try {
      const activeSystemPrompt = MODES[this.currentMode].systemPrompt;
      const messages = this.history.getApiPayload(activeSystemPrompt);

      if (this.currentModel === 'mock-vanguard-model') {
        await new Promise((r) => setTimeout(r, 1000));
        this.spinner.stop();
        console.log(`\n${COLOR.CYAN}vgt [mock] >${COLOR.RESET} Running in offline simulation. Connect Ollama on port 11434 to use real models.\n`);
        this.history.addMessage('assistant', 'Mock Offline Response.');
        this.isGenerating = false;
        return;
      }

      let elapsedMs = 0;
      const metrics = await this.client.streamChat(
        this.currentModel,
        messages,
        (token) => {
          this.renderer.writeToken(token);
          assistantReply += token;
        },
        { signal: this.abortController.signal }
      );
      elapsedMs = metrics.totalDurationMs;

      this.spinner.stop();

      this.history.addMessage('assistant', assistantReply);

      const elapsedSec = (elapsedMs / 1000).toFixed(1);
      console.log(`\n\n ${COLOR.SLATE}[Inference: ${COLOR.CYAN}${elapsedSec}s${COLOR.SLATE} | Context size: ${COLOR.WHITE}~${this.history.getEstimatedTokenCount()} tokens${COLOR.SLATE}]${COLOR.RESET}\n`);
    } catch (err) {
      this.spinner.stop();

      const isAborted = err instanceof Error && (
        err.name === 'AbortError' ||
        err.message.includes('abort') ||
        err.message.includes('cancel')
      );

      if (isAborted) {
        console.log(`\n\n ${COLOR.CRIMSON}[aborted]${COLOR.RESET} ${COLOR.SLATE}Generation aborted by Operator.${COLOR.RESET}\n`);
        if (assistantReply.trim()) {
          this.history.addMessage('assistant', assistantReply + ' [aborted]');
        } else {
          this.history.rollbackLastMessage();
        }
      } else {
        console.log(`\n\n ${COLOR.CRIMSON}[error] Connection Error:${COLOR.RESET} ${(err as Error).message}`);
        console.log(` ${COLOR.SLATE}Please ensure the Ollama server is running locally on port 11434.${COLOR.RESET}\n`);

        this.history.rollbackLastMessage();
      }
    } finally {
      this.renderer.reset();
      this.abortController = null;
      this.isGenerating = false;
    }
  }

  private showHelp(): void {
    console.log();
    console.log(`  ${COLOR.BOLD}${COLOR.WHITE}VANGUARD COMMAND CONSOLE${COLOR.RESET}`);
    console.log(`  ${COLOR.DARK_SLATE}──────────────────────────────────────────────────────────────────────${COLOR.RESET}`);
    console.log(`   ${COLOR.CYAN}/help${COLOR.RESET}             Display this guide menu`);
    console.log(`   ${COLOR.CYAN}/mode [name]${COLOR.RESET}      Switch mode (${COLOR.WHITE}general${COLOR.RESET}, ${COLOR.WHITE}security${COLOR.RESET}, ${COLOR.WHITE}feynman${COLOR.RESET}, ${COLOR.WHITE}caveman${COLOR.RESET})`);
    console.log(`   ${COLOR.CYAN}/model [name]${COLOR.RESET}     Switch Ollama model or list pulled models`);
    console.log(`   ${COLOR.CYAN}/system${COLOR.RESET}           View current system instruction rules`);
    console.log(`   ${COLOR.CYAN}/clear${COLOR.RESET}            Clear chat context memory history`);
    console.log(`   ${COLOR.CYAN}/export${COLOR.RESET}           Save session as a neat Markdown (.md) log`);
    console.log(`   ${COLOR.CRIMSON}/exit${COLOR.RESET}             Shutdown session gracefully`);
    console.log(`  ${COLOR.DARK_SLATE}──────────────────────────────────────────────────────────────────────${COLOR.RESET}`);
    console.log();
  }

  private gracefulExit(): void {
    UI.clearScreen();
    console.log();
    console.log(`  ${COLOR.SLATE}[session completed]${COLOR.RESET}  ${COLOR.CYAN}Goodbye, Operator.${COLOR.RESET}`);
    console.log();
    process.exit(0);
  }
}
