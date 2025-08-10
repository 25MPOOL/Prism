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

  // ストリーミングでテキストを受け取る
  async streamContent(
    prompt: string,
    onDelta: (delta: string) => void | Promise<void>,
    opts?: { signal?: AbortSignal; idleMs?: number },
  ): Promise<string> {
    const model: string = "gemini-1.5-flash-latest";
    const request: GeminiRequest = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    const response = await fetch(
      `${this.baseUrl}/${model}:streamGenerateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // 圧縮を避けることでストリームの中間フラッシュを有効にする
          "Accept-Encoding": "identity",
          Accept: "text/event-stream, application/json",
          // Keep-Aliveヒント
          Connection: "keep-alive",
        },
        body: JSON.stringify(request),
        signal: opts?.signal,
      },
    );

    if (!response.ok || !response.body) {
      throw new Error(
        `Gemini API stream error: ${response.status} ${response.statusText}`,
      );
    }

    // Cloudflare WorkersのReadableStreamDefaultReaderはオプション非対応のため通常モード
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    // アイドルタイムアウト（データ無のまま一定時間で中断）
    const idleMs = opts?.idleMs ?? 15000;
    let idleTimer: number | undefined;
    const resetTimer = () => {
      if (idleTimer !== undefined) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        try {
          opts?.signal?.throwIfAborted?.();
        } catch {}
        // AbortSignalに頼れない環境もあるのでreader.cancelを試みる
        reader.cancel("idle timeout").catch(() => {});
      }, idleMs) as unknown as number;
    };

    resetTimer();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetTimer();
      buffer += decoder.decode(value, { stream: true });

      // SSEは\n\nでイベント区切り、各行は 'data: ...'
      let sepIndex: number = buffer.indexOf("\n\n");
      let progressed = false;
      while (sepIndex !== -1) {
        progressed = true;
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);

        const lines = rawEvent.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const obj = JSON.parse(jsonStr) as GeminiResponse;
            const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (text) {
              fullText += text;
              await onDelta(text);
            }
          } catch {
            // JSONでなければ無視
          }
        }
        // 次のイベント区切りを検索（必須）
        sepIndex = buffer.indexOf("\n\n");
      }

      // JSONLフォーマット（1行1JSON）対応: SSEとして処理されなかった場合に試す
      if (!progressed) {
        const lastNl = buffer.lastIndexOf("\n");
        if (lastNl !== -1) {
          const chunk = buffer.slice(0, lastNl);
          buffer = buffer.slice(lastNl + 1);
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "[DONE]") continue;
            const jsonStr = trimmed.startsWith("data:")
              ? trimmed.slice(5).trim()
              : trimmed;
            try {
              const obj = JSON.parse(jsonStr) as GeminiResponse;
              const text =
                obj?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              if (text) {
                fullText += text;
                await onDelta(text);
              }
            } catch {
              // ignore parse errors for partial lines
            }
          }
        }
      }
    }

    // 残りのバッファにイベントがあれば処理（SSE/JSONL両対応）
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      try {
        const obj = JSON.parse(tail.slice(5).trim()) as GeminiResponse;
        const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) {
          fullText += text;
          await onDelta(text);
        }
      } catch {
        // ignore
      }
    } else if (tail.startsWith("{")) {
      try {
        const obj = JSON.parse(tail) as GeminiResponse;
        const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) {
          fullText += text;
          await onDelta(text);
        }
      } catch {
        // ignore
      }
    }

    if (idleTimer !== undefined) clearTimeout(idleTimer);

    // 何も受け取れなかった場合は非ストリームAPIでフォールバック
    if (!fullText) {
      const fallback = await this.generateContent(prompt);
      // 疑似ストリーミングで最低限の体験を維持
      const size = 60;
      for (let i = 0; i < fallback.length; i += size) {
        const delta = fallback.slice(i, i + size);
        // eslint-disable-next-line no-await-in-loop
        await onDelta(delta);
      }
      return fallback;
    }

    return fullText;
  }
}
