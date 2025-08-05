// GeminiAPIのレスポンス型定義
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
    // ▼▼▼ モデル変更はこの行を変更するだけ！ ▼▼▼
    const model: string = "gemini-1.5-flash-latest"; // "gemini-1.5-pro-latest"もしくは"gemini-1.5-flash-latest"
    // 引数で受け取った文字列を、Geminiが理解できるよう型変換
    const request: GeminiRequest = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    // fetchでサーバーにリクエストを送る
    const response = await fetch(
      // 一旦安いGeminiモデル
      `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          // 送るデータはJSON形式ですよと伝える（重要!）
          "Content-Type": "application/json",
        },
        // JSONに変換したうえでbodyに入れる
        body: JSON.stringify(request),
      },
    );

    //通信が成功したか判定
    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}`,
      );
    }

    // 成功したら、JSON形式からGeminiResponse型に変換してdataに保存
    const data: GeminiResponse = await response.json();

    // Googleの安全ポリシーに違反した場合
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response from Gemini API");
    }

    return data.candidates[0].content.parts[0].text;
  }
}
