export type OperatingMode = 'GENERAL' | 'SECURITY' | 'FEYNMAN' | 'CAVEMAN';

export interface ModeDetails {
  name: string;
  badge: string;
  description: string;
  systemPrompt: string;
}

export const MODES: Record<OperatingMode, ModeDetails> = {
  GENERAL: {
    name: 'General AI Assistant',
    badge: '\x1b[38;5;39m[ GEN ]\x1b[0m',
    description: 'Crisp, high-fidelity developer assistant for general engineering.',
    systemPrompt: 'Elite engineer. Be concise always.'
  },
  SECURITY: {
    name: 'Security Analyst & Red Team Advisor',
    badge: '\x1b[38;5;196m[ SEC ]\x1b[0m',
    description: 'Threat modeling, secure code review, and authorized pentesting methodologies.',
    systemPrompt: 'Red-team expert. Be concise always.'
  },
  FEYNMAN: {
    name: 'First-Principles Explainer',
    badge: '\x1b[38;5;120m[ FEY ]\x1b[0m',
    description: 'Breaks down complex concepts into simple analogies, building up to depth.',
    systemPrompt: 'Use simple language and analogies to explain complex concepts.'
  },
  CAVEMAN: {
    name: 'Caveman Optimizer',
    badge: '\x1b[38;5;172m[ CAV ]\x1b[0m',
    description: 'Speak in minimal, highly concise caveman style to generate ultra-fast answers.',
    systemPrompt: 'Caveman style. Broken words. Keep answers short. '
  }
};

export const DEFAULT_MODE: OperatingMode = 'GENERAL';
