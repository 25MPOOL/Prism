import { EventEmitter } from "events";
import * as readline from "readline";
import WebSocket from "ws";
import type { WebSocketResponse } from "../src/types/definitions";

const WS_URL = "ws://localhost:8787/ws/connect";

class WebSocketTester extends EventEmitter {
  // 👈 EventEmitterを継承
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private rl: readline.Interface;

  constructor() {
    super();
    // readline インターフェースを初期化
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async connect(): Promise<void> {
    console.log("🔌 WebSocketサーバーに接続中!!!");
    this.ws = new WebSocket(WS_URL);

    const ws = this.ws; // this.wsをローカル定数に入れると扱いやすい
    if (!ws) {
      // この行は通常到達しないが、安全のためにチェック
      throw new Error("WebSocketの初期化に失敗しました。");
    }

    // イベントリスナーを一度だけ設定
    ws.on("message", (data) => this.handleRawMessage(data));
    ws.on("error", (error) => this.emit("error", error));
    ws.on("close", () => console.log("🔌 WebSocket接続が閉じられました"));

    return new Promise((resolve, reject) => {
      ws.on("open", () => {
        console.log("✅ WebSocket接続成功ｷﾀ!");
        resolve();
      });
      ws.on("error", reject); // エラー時にもPromiseを終了させる
    });
  }

  private handleRawMessage(data: WebSocket.RawData) {
    try {
      const message: WebSocketResponse = JSON.parse(data.toString());
      console.log("📨 受信:", message);

      // エラーメッセージの場合は専用処理
      if (message.type === "error") {
        console.error("❌ サーバーエラー:", message.data);
        return;
      }

      // 受信したメッセージのタイプをイベントとして発行する
      this.emit(message.type, message.data);
    } catch (error) {
      console.error("❌ メッセージ解析エラー:", error);
    }
  }

  private send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("📤 送信:", message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("❌ WebSocket接続が開いていません!");
    }
  }

  // --- テストメソッド群 ---

  async testSessionCreate(): Promise<string> {
    console.log("\n🆔 セッション作成テスト開始");
    this.send({
      type: "session_create",
      data: null,
      messageId: `session_${Date.now()}`,
    });

    // 'session_created'イベントが発行されるまで待つ
    return new Promise((resolve, reject) => {
      this.once("session_created", (data) => {
        this.sessionId = data.session.id;
        console.log(`🆔 セッションID取得: ${this.sessionId}`);
        if (this.sessionId) {
          resolve(this.sessionId);
        } else {
          reject(new Error("セッションIDの取得に失敗しました。"));
        }
      });
    });
  }

  async testChat(message: string): Promise<any> {
    if (!this.sessionId) throw new Error("セッションIDがありません。");

    console.log(`\n💬 チャットテスト開始: "${message}"`);
    this.send({
      type: "chat",
      data: { sessionId: this.sessionId, message },
      messageId: `chat-${Date.now()}`,
    });

    // 'chat_response'イベントが発行されるまで待つ
    return new Promise((resolve) => this.once("chat_response", resolve));
  }

  // ユーザーからの入力を受け取る
  private async getUserInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  // 対話式チャットを開始するメソッド
  async startInteractiveChat(): Promise<void> {
    console.log("\n💬 対話式チャットを開始します");
    console.log("終了するには'exit'または'quit'と入力してください\n");

    while (true) {
      try {
        const userMessage = await this.getUserInput("あなた：");

        // 終了コマンドのチェック
        if (
          userMessage.toLowerCase() === "exit" ||
          userMessage.toLowerCase() === "quit"
        ) {
          console.log("👋 チャットを終了します");
          break;
        }

        // 空の入力をスキップ
        if (!userMessage.trim()) {
          continue;
        }

        // AIにメッセージを送信
        const response = await this.testChat(userMessage);
        console.log(`🤖 AI: ${response.message.content}\n`);
      } catch (error) {
        console.error("❌ チャットエラー:", error);
      }
    }
  }

  close(): void {
    this.ws?.close();
    this.rl.close(); // readline インターフェースも閉じる
  }
}

// --- メイン実行部分 ---

async function runInteractiveTests(): Promise<void> {
  const tester = new WebSocketTester();

  try {
    await tester.connect();
    console.log("\n=== WebSocketテスト開始 ===");

    // セッションを作成し、完了を待つ
    await tester.testSessionCreate();

    // 対話式チャットを開始
    await tester.startInteractiveChat();

    console.log("\n=== テスト完了 ===");
  } catch (error) {
    console.error("❌ テスト実行エラー:", error);
  } finally {
    tester.close(); // 成功しても失敗しても必ず接続を閉じる
  }
}

runInteractiveTests();
