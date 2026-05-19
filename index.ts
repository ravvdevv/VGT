import { OllamaClient } from './src/client';
import { SessionHistory } from './src/history';
import { InteractiveShell } from './src/shell';
import { COLOR, UI } from './src/ui';

const VERSION = '1.0.0';

function showUsage(): void {
  UI.clearScreen();
  console.log();
  console.log(`  ${COLOR.BOLD}${COLOR.WHITE}VGT COMMAND LINE HELP v${VERSION}${COLOR.RESET}`);
  console.log(`  ${COLOR.DARK_SLATE}──────────────────────────────────────────────────────────────────────${COLOR.RESET}`);
  console.log(`   ${COLOR.BOLD}USAGE:${COLOR.RESET}  bun index.ts [options]`);
  console.log();
  console.log(`   ${COLOR.BOLD}OPTIONS:${COLOR.RESET}`);
  console.log(`     ${COLOR.CYAN}--model <name>${COLOR.RESET}   Specify starting Ollama model`);
  console.log(`     ${COLOR.CYAN}--mode <name>${COLOR.RESET}    Specify starting operating mode (${COLOR.WHITE}general, security, feynman, caveman${COLOR.RESET})`);
  console.log(`     ${COLOR.CYAN}--version, -v${COLOR.RESET}    Show current program version info`);
  console.log(`     ${COLOR.CYAN}--help, -h${COLOR.RESET}       Show this usage information`);
  console.log();
  console.log(`   ${COLOR.BOLD}EXAMPLES:${COLOR.RESET}`);
  console.log(`     bun index.ts`);
  console.log(`     bun index.ts --mode caveman`);
  console.log(`     bun index.ts --model llama3 --mode feynman`);
  console.log(`  ${COLOR.DARK_SLATE}──────────────────────────────────────────────────────────────────────${COLOR.RESET}`);
  console.log();
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let initialModel: string | undefined = undefined;
  let initialMode: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--help' || arg === '-h') {
      showUsage();
    } else if (arg === '--version' || arg === '-v') {
      console.log(`Vanguard Terminal (VGT) - Version ${VERSION}`);
      process.exit(0);
    } else if (arg === '--model') {
      initialModel = args[i + 1];
      i++;
    } else if (arg === '--mode') {
      initialMode = args[i + 1]?.toUpperCase();
      i++;
    }
  }

  const client = new OllamaClient();
  const history = new SessionHistory();
  const shell = new InteractiveShell(client, history);

  if (initialMode && ['GENERAL', 'SECURITY', 'FEYNMAN', 'CAVEMAN'].includes(initialMode)) {
    (shell as any).currentMode = initialMode;
  }
  if (initialModel) {
    (shell as any).currentModel = initialModel;
  }

  await shell.start();
}

main().catch((err) => {
  console.error(`\n${COLOR.CRIMSON}Fatal System Error:${COLOR.RESET}`, (err as Error).message);
  process.exit(1);
});