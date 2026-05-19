import { cpus } from 'os';

const CORES_LENGTH = cpus().length;
// More aggressive thread allocation for large systems
const OPTIMAL_THREADS = Math.min(16, Math.max(4, Math.floor(CORES_LENGTH * 0.75)));

const TEXT_DECODER = new TextDecoder();

export interface OllamaModel {
  name: string;
  size: number;
  family: string;
  parameterSize: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, { signal: AbortSignal.timeout(1500) });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Triggers a model warm-up to load it into VRAM and prepare the cache.
   */
  async warmup(model: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: 'warmup' }],
          stream: false,
          keep_alive: '60m',
          options: { num_predict: 1 }
        }),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      // Ignore warmup failures
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return [];
      
      const data = (await res.json()) as {
        models?: Array<{
          name: string;
          size: number;
          details?: {
            family?: string;
            parameter_size?: string;
          };
        }>;
      };

      if (!data.models) return [];

      return data.models.map((m) => ({
        name: m.name,
        size: m.size,
        family: m.details?.family || 'unknown',
        parameterSize: m.details?.parameter_size || 'unknown',
      }));
    } catch {
      return [];
    }
  }

  async streamChat(
    model: string,
    messages: ChatMessage[],
    onToken: (token: string) => void,
    options: { temperature?: number; signal?: AbortSignal } = {}
  ): Promise<{ totalDurationMs: number }> {
    const { temperature = 0.0, signal } = options;

    const bodyPayload: any = {
      model,
      messages,
      stream: true,
      keep_alive: '120m',
      options: {
        num_ctx: 4096,
        num_predict: 2048,
        num_thread: OPTIMAL_THREADS,
        temperature: 0.0,
        top_k: 1,
        top_p: 1.0,
        repeat_penalty: 1.0,
        num_batch: 512,
        use_mmap: true,
        use_mlock: true,
        f16_kv: true,
        low_vram: false,
        num_gpu: 99, // Force maximum GPU layers
        main_gpu: 0,
        num_keep: 24, // Keep critical system tokens in cache
      }
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      signal: signal,
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat API returned status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let buffer = '';
    let totalDurationMs = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += TEXT_DECODER.decode(value, { stream: true });
        
        let start = 0;
        let newlineIdx = buffer.indexOf('\n');
        
        if (newlineIdx === -1) continue;
        
        while (newlineIdx !== -1) {
          const line = buffer.substring(start, newlineIdx).trim();
          start = newlineIdx + 1;

          if (line) {
            try {
              const chunk = JSON.parse(line) as {
                message?: { content?: string };
                total_duration?: number;
                done?: boolean;
              };

              if (chunk.message?.content) {
                onToken(chunk.message.content);
              }

              if (chunk.done && chunk.total_duration) {
                totalDurationMs = Math.round(chunk.total_duration / 1_000_000);
              }
            } catch (err) {
            }
          }
          
          newlineIdx = buffer.indexOf('\n', start);
        }
        
        buffer = start > 0 ? buffer.substring(start) : buffer;
      }
    } finally {
      reader.releaseLock();
    }

    return { totalDurationMs };
  }
}
