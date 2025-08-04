// GeminiAPIレスポンスの型定義
export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

// リクエスト型定義
export interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text: string;
      image?: string;
    }>;
  }>;
}

// Gemini APIクライアントクラス
export class GeminiAPIClient {
  private apiKey: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateContent(prompt: string): Promise<string> {
    // 実装予定
    throw new Error("実装予定だバカ");
  }
}
