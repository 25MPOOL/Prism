import { GeminiAPIClient } from "./google/gemini-api";

const PROMPT_TEMPLATE = `
Just reply A
`;

export interface ConversationMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

export interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  phase: "idea" | "requirements" | "tasks";
}

export class ConversationService {
  private geminiClient: GeminiAPIClient;

  constructor(apiKey: string) {
    this.geminiClient = new GeminiAPIClient(apiKey);
  }

  // メインの対話処理メソッド
  async processMessage(
    sessionId: string,
    userMessage: string,
    context?: ConversationSession,
  ): Promise<ConversationMessage> {
    // Prismプロンプト構築
    const prompt = PROMPT_TEMPLATE;

    //Gemini APIで応答生成
    const aiResponse = await this.geminiClient.generateContent(prompt);

    return {
      id: crypto.randomUUID(),
      role: "ai",
      content: aiResponse,
      timestamp: new Date(),
    };
  }

  // セッション作成メソッド
  async createSession(): Promise<ConversationSession> {
    return {
      id: crypto.randomUUID(),
      messages: [],
      phase: "idea",
    };
  }
}
