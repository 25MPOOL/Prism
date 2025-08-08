import type { D1Database } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { conversations, messages } from "../../drizzle/schema";
import type {
  ConversationMessage,
  ConversationSession,
  GeneratedIssue,
} from "../types/definitions";
import { GeminiAPIClient } from "./google/gemini-api";
import {
  PROMPT_TEMPLATE,
  TASKS_GENERATION_TEMPLATE,
  REQUIREMENTS_DOC_TEMPLATE,
} from "./prompts";

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

    // 2-1. もし、直前のAIのメッセージが確認メッセージだったら（フェーズ遷移/Issue登録）
    const lastMessage = session.messages[session.messages.length - 1];
    const wasPhaseTransitionConfirmation =
      lastMessage?.role === "ai" &&
      (lastMessage.content.includes("フェーズに進み") ||
        lastMessage.content.includes("フェーズに進んでもよろしいですか？"));
    const wasIssueRegistrationConfirmation =
      lastMessage?.role === "ai" &&
      lastMessage.content.includes("Issue登録に進みます");
    const wasIssueGenerationConfirmation =
      lastMessage?.role === "ai" &&
      lastMessage.content.includes("Issue案を生成します");

    const isPositive =
      /はい|OK|お願い|進めて|いいです|わかった|了解|うん|ええ|賛成|ぜひ|おねがい|おk|ok|y(es)?/i.test(
        userMessage,
      );
    const isNegative = /いいえ|やめ|不要|戻|no|嫌|いえ|いや|保留|まだ/i.test(
      userMessage,
    );

    if (wasPhaseTransitionConfirmation) {
      if (isPositive) {
        const newPhase = this.getNextPhase(session.phase);
        if (newPhase) {
          await this.updatePhase(sessionId, newPhase);
          // 新しいフェーズの最初の質問を返す
          const firstQuestion = await this.getFirstQuestionForPhase(
            newPhase,
            sessionId,
          );
          return this.saveMessage(sessionId, "ai", firstQuestion);
        }
      } else if (isNegative) {
        const stayMessage =
          "承知いたしました。では、もう少し現在のフェーズについてお話ししましょう。他に何か追加したいことや、修正したい点はありますか？";
        return this.saveMessage(sessionId, "ai", stayMessage);
      }
      // 肯定/否定どちらでもない曖昧な返答は、そのまま通常フローに続行
    } else if (wasIssueRegistrationConfirmation) {
      if (isPositive) {
        const proceedMessage =
          "ありがとうございます。では、GitHubリポジトリの選択に進みましょう。準備ができたらリポジトリ名を教えてください。";
        return this.saveMessage(sessionId, "ai", proceedMessage);
      }
      if (isNegative) {
        const reviseMessage =
          "承知しました。Issue登録は保留します。修正したい点を教えてください。";
        return this.saveMessage(sessionId, "ai", reviseMessage);
      }
      // ここも曖昧な返答は通常フローに続行
    }

    if (wasIssueGenerationConfirmation) {
      if (isPositive) {
        try {
          const issues = await this.generateTasksFromSession(sessionId);
          const issueList = issues
            .map((i) => `- **${i.title}**\n  - ${i.description}`)
            .join("\n\n");
          const msg =
            "要件定義書をもとに、以下のGitHub Issue案を生成しました。\n\n" +
            issueList +
            "\n\nこの内容でよろしければ、GitHubリポジトリを選択してIssue登録に進みます。よろしいですか？";
          return this.saveMessage(sessionId, "ai", msg);
        } catch (error) {
          console.error("Issue案作成中にエラー", error);
          return this.saveMessage(
            sessionId,
            "ai",
            "Issue案の生成に失敗しました。少し時間が経過してから、もう一度お試しください。",
          );
        }
      } else if (isNegative) {
        return this.saveMessage(
          sessionId,
          "ai",
          "承知しました。要件定義書のどこを修正したいですか？",
        );
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
            "次の「要件定義」フェーズに進み、具体的な機能を一緒に考えていきませんか？";
          break;
        case "tasks":
          confirmationMessage =
            "機能要件がかなり具体的になりましたね！素晴らしいです。\n" +
            "これを元に、開発タスクを洗い出す**「タスク化」**フェーズに進んでもよろしいですか？";
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

  // 要件定義書を生成するメソッド
  private async generateRequirementsDocFromSession(
    sessionId: string,
  ): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session || session.messages.length === 0) {
      throw new Error("要件定義書の生成に必要な会話履歴がありません");
    }
    const historyText = session.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const prompt = REQUIREMENTS_DOC_TEMPLATE.replace("{HISTORY}", historyText);
    const md = await this.geminiClient.generateContent(prompt);
    // コードブロック除去+trim
    const m = md.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n?```$/m);
    return (m ? m[1] : md).trim();
  }

  // 対話履歴からIssueを生成するメソッド
  async generateTasksFromSession(sessionId: string): Promise<GeneratedIssue[]> {
    const session = await this.getSession(sessionId);
    if (!session || session.messages.length === 0) {
      throw new Error("タスク生成のための十分な会話履歴がありません");
    }

    const historyText = session.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const prompt = TASKS_GENERATION_TEMPLATE.replace("{HISTORY}", historyText);

    // Gemini APIで応答生成
    const jsonResponse = await this.geminiClient.generateContent(prompt);

    try {
      // より堅牢な正規表現でMarkdownコードブロックを除去
      const codeBlockMatch = jsonResponse.match(
        /^```(?:\w+)?\s*\n([\s\S]*?)\n?```$/m,
      );
      const cleanJson = (
        codeBlockMatch ? codeBlockMatch[1] : jsonResponse
      ).trim();
      const issues: GeneratedIssue[] = JSON.parse(cleanJson);
      return issues;
    } catch (error) {
      console.error(
        "AIからのJSON応答の解析に失敗しました:",
        jsonResponse,
        error,
      );
      throw new Error(
        "タスクの生成に失敗しました。AIの応答形式が正しくありません。しばらく時間をおいて再試行してください。",
      );
    }
  }

  private getNextPhase(
    currentPhase: "idea" | "requirements" | "tasks",
  ): "requirements" | "tasks" | null {
    if (currentPhase === "idea") return "requirements";
    if (currentPhase === "requirements") return "tasks";
    return null;
  }

  // 各フェーズの最初の質問を返すヘルパーメソッド
  private async getFirstQuestionForPhase(
    phase: "requirements" | "tasks",
    sessionId: string,
  ): Promise<string> {
    if (phase === "requirements") {
      return "ありがとうございます。では、このアプリに必要な機能を一緒に考えていきましょう。まずは思いつくままに、どんな機能が欲しいかリストアップしてもらえますか？";
    }
    if (phase === "tasks") {
      try {
        const reqDoc = await this.generateRequirementsDocFromSession(sessionId);
        return (
          "ここまでの対話を基に、要件定義書を作成しました。\n\n" +
          reqDoc +
          "\n\nこの内容でよろしければ、Issue案を生成します。よろしいですか？"
        );
      } catch (error) {
        console.error("要件定義書生成中にエラーが発生しました:", error);
        return "申し訳ありません、要件定義書の生成中にエラーが発生しました。先にIssue案の生成に進みますか？";
      }
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
