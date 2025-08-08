import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { GeminiAPIClient } from "./google/gemini-api";
import { conversations, messages } from "../../drizzle/schema";
import type {
  ConversationMessage,
  ConversationSession,
} from "../types/definitions";
import type { D1Database } from "@cloudflare/workers-types";
import { PROMPT_TEMPLATE, } from "./prompts";

export class ConversationService {
  private geminiClient: GeminiAPIClient;
  private db: ReturnType<typeof drizzle>;

  constructor(apiKey: string, database: D1Database) {
    this.geminiClient = new GeminiAPIClient(apiKey);
    this.db = drizzle(database);
  }

  // セッション作成メソッド
  async createSession(
    userId: string = "anonymous",
  ): Promise<ConversationSession> {
    const sessionId = crypto.randomUUID();
    const now = new Date();

    console.log("🔄 DB: セッションを作成中...", sessionId); // デバッグログ追加

    await this.db.insert(conversations).values({
      id: sessionId,
      userId,
      title: `対話セッション ${now.toLocaleString()}`,
      phase: "idea",
      createdAt: now,
      updatedAt: now,
    });

    console.log("✅ DB: セッション作成完了", sessionId); // デバッグログ追加

    return {
      id: sessionId,
      messages: [],
      phase: "idea",
    };
  }

  // メインの対話処理メソッド
  async processMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<ConversationMessage> {
    // 1. ユーザーメッセージをDBに保存
    await this.saveMessage(sessionId, "user", userMessage);

    // 2. セッション情報と履歴を取得
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("セッションが見つかりません");
    }

    // 2-1. もし、直前のAIのメッセージがphase移行確認だったら
    const lastMessage = session.messages[session.messages.length - 1];
    if (lastMessage?.role === "ai" && lastMessage.content.includes("")) {
      // ユーザーが「はい」など肯定的な返事をしたら、フェーズを更新
      if (
        userMessage.match(
          /はい|OK|お願い|進めて|いい|わかった|了解|うん|ええ|賛成|もち|ぜひ|ye|おk|y/i,
        )
      ) {
        const newPhase = this.getNextPhase(session.phase);
        if (newPhase) {
          await this.updatePhase(sessionId, newPhase);
          // 新しいフェーズの最初の質問を返す
          const firstQuestion = this.getFirstQuestionForPhase(newPhase);
          return this.saveMessage(sessionId, "ai", firstQuestion);
        }
      } else {
        const stayMessage =
          "承知いたしました。では、もう少し現在のフェーズについてお話ししましょう。他に何か追加したいことや、修正したい点はありますか？";
        return this.saveMessage(sessionId, "ai", stayMessage);
      }
    }
    // 3. 履歴を文字列に変換
    const historyText = session.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    // 4. プロンプトを構築
    const prompt = PROMPT_TEMPLATE.replace("{PHASE}", session.phase)
      .replace("{HISTORY}", historyText)
      .replace("{USER_MESSAGE}", userMessage);

    // 5. Gemini APIで応答生成
    const aiResponse = await this.geminiClient.generateContent(prompt);

    // 6. AIからの「合言葉」をチェック
    if (aiResponse.trim() === "[TRANSITION_SUGGESTION]") {
      // AIからphase移行の提案が来たら、プログラムが確認メッセージを生成
      const currentPhase = this.getNextPhase(session.phase);
      let confirmationMessage = "";

      switch (currentPhase) {
        case "requirements":
          confirmationMessage =
            "ありがとうございます。アイデアの輪郭が見えてきましたね！\n" +
            "次の「要件定義」フェーズに進み、具体的な機能を一緒に考えていきませんか？" +
            "\n";
          break;
        case "tasks":
          confirmationMessage =
            "機能要件がかなり具体的になりましたね！素晴らしいです。\n" +
            "これを元に、開発タスクを洗い出す**「タスク化」**フェーズに進んでもよろしいですか？" +
            "\n";
          break;
        // tasksフェーズからは移行しないが念のため
        default:
          confirmationMessage =
            "このメッセージが表示されることはありません。表示されましたら、製作者にお伝えください。";
          break;
      }
      return this.saveMessage(sessionId, "ai", confirmationMessage);
    }
    // 7. AIの応答をDBに保存
    return this.saveMessage(sessionId, "ai", aiResponse);
  }

  // 次のフェーズを返すヘルパーメソッド
  private getNextPhase(
    currentPhase: "idea" | "requirements" | "tasks",
  ): "requirements" | "tasks" | null {
    if (currentPhase === "idea") return "requirements";
    if (currentPhase === "requirements") return "tasks";
    return null;
  }

  // 各フェーズの最初の質問を返すヘルパーメソッド
  private getFirstQuestionForPhase(phase: "requirements" | "tasks"): string {
    if (phase === "requirements") {
      return "ありがとうございます。では、このアプリに必要な機能を一緒に考えていきましょう。まずは思いつくままに、どんな機能が欲しいかリストアップしてもらえますか？";
    }
    if (phase === "tasks") {
      return "この内容でよろしければ、GitHubリポジトリを選択して、Issue登録に進みます。よろしいですか？";
    }
    return "";
  }

  // フェーズを更新するメソッド
  private async updatePhase(
    sessionId: string,
    newPhase: "idea" | "requirements" | "tasks",
  ): Promise<void> {
    await this.db
      .update(conversations)
      .set({
        phase: newPhase,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, sessionId));
  }

  // セッション情報を取得
  private async getSession(
    sessionId: string,
  ): Promise<ConversationSession | null> {
    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, sessionId));

    if (!conversation) return null;

    const sessionMessages = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, sessionId))
      .orderBy(messages.createdAt); // 念のため時系列順にソート

    return {
      id: conversation.id,
      messages: sessionMessages.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "ai",
        content: msg.content,
        timestamp: new Date(msg.createdAt),
      })),
      phase: conversation.phase as "idea" | "requirements" | "tasks",
    };
  }

  // メッセージをDBに保存
  private async saveMessage(
    sessionId: string,
    role: "user" | "ai",
    content: string,
  ): Promise<ConversationMessage> {
    const messageId = crypto.randomUUID();
    const now = new Date();

    console.log(
      `🔄 DB: メッセージを保存中... [${role}] ${content.substring(0, 50)}...`,
    ); // デバッグログ追加

    await this.db.insert(messages).values({
      id: messageId,
      conversationId: sessionId,
      role,
      content,
      createdAt: now,
    });

    console.log(`✅ DB: メッセージ保存完了 ${messageId}`); // デバッグログ追加

    return {
      id: messageId,
      role,
      content,
      timestamp: now,
    };
  }
}
