import { writeFileSync } from 'fs';
import { join } from 'path';
import type { ChatMessage } from './client';
import type { OperatingMode } from './prompt';

export class SessionHistory {
  private messages: ChatMessage[] = [];
  private maxEstimatedTokens = 2048;
  private totalCharLength = 0;
  private baseSystemPrompt = 'Vanguard Terminal. Elite. Concise.';

  addMessage(role: ChatMessage['role'], content: string): void {
    const last = this.messages[this.messages.length - 1];
    if (last && last.role === role && role === 'assistant') {
      last.content += content;
      this.totalCharLength += content.length;
    } else {
      this.messages.push({ role, content });
      this.totalCharLength += content.length;
    }
    this.pruneHistory();
  }

  clear(): void {
    this.messages = [];
    this.totalCharLength = 0;
  }

  getRawMessages(): ChatMessage[] {
    return this.messages;
  }

  getApiPayload(modePrompt: string): ChatMessage[] {
    const payload: ChatMessage[] = [
      { role: 'system', content: this.baseSystemPrompt }
    ];

    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i]!;
      if (i === this.messages.length - 1 && msg.role === 'user') {
        payload.push({
          role: 'user',
          content: `[Instruction: ${modePrompt}]\n${msg.content}`
        });
      } else {
        payload.push({ ...msg });
      }
    }

    if (this.messages.length === 0) {
      payload.push({ role: 'system', content: modePrompt });
    }

    return payload;
  }

  getEstimatedTokenCount(): number {
    return Math.round(this.totalCharLength / 4);
  }

  rollbackLastMessage(): void {
    const popped = this.messages.pop();
    if (popped) {
      this.totalCharLength -= popped.content.length;
    }
  }

  private pruneHistory(): void {
    while (this.getEstimatedTokenCount() > this.maxEstimatedTokens && this.messages.length > 3) {
      const removed = this.messages.splice(1, 2);
      for (let i = 0; i < removed.length; i++) {
        this.totalCharLength -= removed[i]!.content.length;
      }
    }
  }

  exportToMarkdown(
    cwd: string,
    modelName: string,
    mode: OperatingMode
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vgt-session-${mode.toLowerCase()}-${timestamp}.md`;
    const filePath = join(cwd, filename);

    const contentLines: string[] = [
      `# Vanguard Terminal (VGT) Session Log`,
      `*Generated on: ${new Date().toLocaleString()}*`,
      `*Model: \`${modelName}\`*`,
      `*Operating Mode: \`${mode}\`*`,
      `---`,
      ''
    ];

    for (let i = 1; i < this.messages.length; i++) {
      const msg = this.messages[i]!;
      if (msg.role === 'user') {
        contentLines.push(`### 👤 User`);
        contentLines.push(`> ${msg.content.split('\n').join('\n> ')}`);
        contentLines.push('');
      } else if (msg.role === 'assistant') {
        contentLines.push(`### 🤖 Vanguard`);
        contentLines.push(msg.content);
        contentLines.push('');
        contentLines.push('---');
        contentLines.push('');
      }
    }

    try {
      writeFileSync(filePath, contentLines.join('\n'), 'utf-8');
      return filename;
    } catch (err) {
      throw new Error(`Failed to write export file: ${(err as Error).message}`);
    }
  }
}
