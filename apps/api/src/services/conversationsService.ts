import type { D1Database } from "@cloudflare/workers-types";
import { eq, and, desc, gte, inArray, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { conversations, messages } from "../../drizzle/schema";
import type {
  ConversationMessage,
  ConversationSession,
  GeneratedIssue,
  ConversationSummary,
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
    // TODO: ユーザーIDをDBから取得する
    userId: string = "",
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
    if (userMessage === "要件定義書を生成") {
      try {
        const requirementsDoc =
          await this.generateRequirementsDocFromSession(sessionId);
        const response =
          "これまでの対話を基に、要件定義書を生成しました。\n\n" +
          requirementsDoc;
        return this.saveMessage(sessionId, "ai", response);
      } catch (error) {
        console.error("要件定義書生成中にエラー:", error);
        return this.saveMessage(
          sessionId,
          "ai",
          "申し訳ありません、要件定義書の生成中にエラーが発生しました。もう少し対話を進めてから再試行してください。",
        );
      }
    }
    // 1. ユーザーメッセージをDBに保存
    await this.saveMessage(sessionId, "user", userMessage);

    // 2. セッション情報と履歴を取得
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("セッションが見つかりません");
    }

    // 2-1. 直前のAIメッセージをチェック（ユーザーメッセージの1つ前のAIメッセージ）
    const lastAiMessage = session.messages
      .filter((m) => m.role === "ai")
      .slice(-1)[0]; // 最後のAIメッセージを取得
    console.log("🔍 デバッグ: 最後のAIメッセージ", {
      role: lastAiMessage?.role,
      content: lastAiMessage?.content?.substring(0, 100),
    });

    const wasPhaseTransitionConfirmation =
      lastAiMessage?.role === "ai" &&
      (lastAiMessage.content.includes("フェーズに進み") ||
        lastAiMessage.content.includes("フェーズに進んでもよろしいですか？"));

    console.log("🔍 デバッグ: フェーズ移行確認判定", {
      wasPhaseTransitionConfirmation,
      userMessage,
    });
    const wasIssueRegistrationConfirmation =
      lastAiMessage?.role === "ai" &&
      lastAiMessage.content.includes("Issue登録に進みます");
    const wasIssueGenerationConfirmation =
      lastAiMessage?.role === "ai" &&
      lastAiMessage.content.includes("Issue案を生成します");

    console.log("🔍 デバッグ: Issue関連判定", {
      wasIssueRegistrationConfirmation,
      wasIssueGenerationConfirmation,
      lastAiContent: lastAiMessage?.content?.substring(0, 150),
    });

    const isPositive =
      /はい|OK|お願い|進めて|いい|わかった|了解|うん|ええ|賛成|ぜひ|おねがい|おk|ok|うい|大丈夫|y(es)?/i.test(
        userMessage,
      );
    const isNegative = /いいえ|やめ|不要|戻|no|嫌|いえ|いや|保留|まだ/i.test(
      userMessage,
    );

    console.log("🔍 デバッグ: 肯定/否定判定", {
      userMessage,
      isPositive,
      isNegative,
    });

    // 2-2. フェーズ移行確認への回答処理（回数制限チェックより優先）

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
          "[SHOW_REPOSITORY_SELECTION]\nGitHubリポジトリを選択してください。Issue登録を開始します。";
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

    // 2-3. 回数制限チェック（確認メッセージ処理の後に実行）
    const userMessagesInPhase = session.messages.filter(
      (m) => m.role === "user",
    ).length;

    // 最近にフェーズ移行を拒否されたかチェック
    const recentMessages = session.messages.slice(-4); // 直近4メッセージをチェック
    const recentlyRejectedTransition = recentMessages.some(
      (msg) =>
        msg.role === "ai" &&
        msg.content.includes("もう少し現在のフェーズについてお話ししましょう"),
    );

    // `idea`フェーズで、ユーザーの発言が4回に達し、かつ最近拒否されていない場合のみ移行を提案
    if (
      session.phase === "idea" &&
      userMessagesInPhase >= 4 &&
      !recentlyRejectedTransition
    ) {
      console.log(
        "🗣️ ideaフェーズの対話回数が上限に達したため、移行を提案します。",
      );
      const confirmationMessage =
        "ありがとうございます。アイデアの輪郭が見えてきましたね！\n" +
        "次の**「要件定義」**フェーズに進み、具体的な機能を一緒に考えていきませんか？";
      return this.saveMessage(sessionId, "ai", confirmationMessage);
    }

    // `requirements`フェーズで、ユーザーの発言が6回に達し、かつ最近拒否されていない場合のみ移行を提案
    if (
      session.phase === "requirements" &&
      userMessagesInPhase >= 8 &&
      !recentlyRejectedTransition
    ) {
      console.log(
        "🗣️ requirementsフェーズの対話回数が上限に達したため、移行を提案します。",
      );
      const confirmationMessage =
        "機能要件がかなり具体的になりましたね！素晴らしいです。\n" +
        "これを元に、開発タスクを洗い出す**「タスク化」**フェーズに進んでもよろしいですか？";
      return this.saveMessage(sessionId, "ai", confirmationMessage);
    }

    // 3. 履歴を文字列に変換
    const historyText = session.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    // 4. プロンプトを構築
    const prompt = PROMPT_TEMPLATE.replace("{PHASE}", session.phase)
      .replace("{HISTORY}", historyText)
      .replace("{USER_MESSAGE}", userMessage);

    // 5. Gemini APIで応答生成（非ストリーム版）
    let aiResponse: string;
    try {
      aiResponse = await this.geminiClient.generateContent(prompt);
    } catch (error) {
      if (
        error.message.includes("quota") ||
        error.message.includes("rate limit")
      ) {
        return this.saveMessage(
          sessionId,
          "ai",
          "申し訳ありません。現在APIの利用制限に達しています。しばらく時間をおいてから再度お試しください。",
        );
      }
      throw error;
    }

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

  // 真のストリーミング用（呼び出し側からonDeltaを注入）
  public async processMessageStream(
    sessionId: string,
    userMessage: string,
    onDelta: (delta: string) => void | Promise<void>,
    opts?: { signal?: AbortSignal; idleMs?: number },
  ): Promise<ConversationMessage> {
    // 1. ユーザーメッセージ保存
    await this.saveMessage(sessionId, "user", userMessage);

    // 2. セッションと履歴取得
    const session = await this.getSession(sessionId);
    if (!session) throw new Error("セッションが見つかりません");

    const historyText = session.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
    const prompt = PROMPT_TEMPLATE.replace("{PHASE}", session.phase)
      .replace("{HISTORY}", historyText)
      .replace("{USER_MESSAGE}", userMessage);

    let full = "";
    try {
      // 先に短い「応答準備中...」を送るとUXが向上
      await onDelta("");
      full = await this.geminiClient.streamContent(prompt, onDelta, opts);
    } catch (error) {
      if (
        (error as Error).message.includes("quota") ||
        (error as Error).message.includes("rate limit")
      ) {
        full =
          "申し訳ありません。現在APIの利用制限に達しています。しばらく時間をおいてから再度お試しください。";
      } else {
        throw error;
      }
    }

    return this.saveMessage(sessionId, "ai", full);
  }

  // 要件定義書を生成するメソッド
  public async generateRequirementsDocFromSession(
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
    let md: string;
    try {
      md = await this.geminiClient.generateContent(prompt);
    } catch (error) {
      if (
        error.message.includes("quota") ||
        error.message.includes("rate limit")
      ) {
        throw new Error(
          "APIの利用制限に達しています。しばらく時間をおいてから再度お試しください。",
        );
      }
      throw error;
    }
    // コードブロック除去+trim
    const m = md.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n?```$/m);
    return (m ? m[1] : md).trim();
  }

  // 対話履歴からIssueを生成するメソッド
  async generateTasksFromSession(sessionId: string): Promise<GeneratedIssue[]> {
    const session = await this.getSession(sessionId);
    if (!session || session.messages.length === 0) {
      throw new Error("Issue生成のための十分な会話履歴がありません");
    }

    const historyText = session.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const prompt = TASKS_GENERATION_TEMPLATE.replace("{HISTORY}", historyText);

    // Gemini APIで応答生成
    let jsonResponse: string;
    try {
      jsonResponse = await this.geminiClient.generateContent(prompt);
    } catch (error) {
      if (
        error.message.includes("quota") ||
        error.message.includes("rate limit")
      ) {
        throw new Error(
          "APIの利用制限に達しています。しばらく時間をおいてから再度お試しください。",
        );
      }
      throw error;
    }

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
        "Issueの生成に失敗しました。AIの応答形式が正しくありません。しばらく時間をおいて再試行してください。",
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
        return "申し訳ありません、要件定義書の生成中にエラーが発生しました。もう少し時間が経ちましたら再試行してください。";
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

  // 他人のsessionIdを使った情報漏洩を防ぐ
  public async getSessionOwner(sessionId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ userId: conversations.userId })
      .from(conversations)
      .where(eq(conversations.id, sessionId))
      .limit(1);
    return row?.userId ?? null;
  }

  // セッション一覧取得
  async listSessionsByUser(
    userId: string,
    opts?: { days?: number; limit?: number },
  ): Promise<ConversationSummary[]> {
    const days = opts?.days ?? 7;
    const limit = opts?.limit ?? 50;
    const threshold = new Date(Date.now() - days * 86_400_000); // 24 x 60 x 60 x 1000 = 86_400_000

    // 対象ユーザーの会話（最近順）
    const convs = await this.db
      .select({
        id: conversations.id,
        title: conversations.title,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          gte(conversations.updatedAt, threshold),
        ),
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);

    if (convs.length === 0) return [];

    // 先頭メッセージをまとめて取得（各会話のタイトル候補に使う）
    const ids = convs.map((c) => c.id);
    const firstMsgs = await this.db
      .select({
        conversationId: messages.conversationId,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, ids))
      .orderBy(messages.conversationId, asc(messages.createdAt));

    const firstByConv = new Map<string, string>();
    for (const m of firstMsgs) {
      if (!firstByConv.has(m.conversationId)) {
        firstByConv.set(m.conversationId, m.content);
      }
    }

    return convs.map((c) => {
      const first = firstByConv.get(c.id) ?? c.title ?? "";
      const title = first.slice(0, 10); // 最初の会話10文字をタイトルに指定
      return {
        id: c.id,
        title,
        updatedAt: new Date(c.updatedAt as unknown as number),
      };
    });
  }

  public async getSessionData(sessionId: string) {
    const s = await this.getSession(sessionId); // 既存privateを利用
    if (!s) throw new Error("Session not found");
    return s; // { id, messages, phase }
  }

  // メッセージをDBに保存
  public async saveMessage(
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
    if (role === "user") {
      // このセッションでの「ユーザー」メッセージ件数を数える
      const [{ cnt }] = await this.db
        .select({ cnt: sql<number>`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, sessionId),
            eq(messages.role, "user"),
          ),
        );

      // 初回のユーザーメッセージならタイトルを10文字で更新
      if (cnt === 1) {
        await this.db
          .update(conversations)
          .set({ title: content.slice(0, 10), updatedAt: now })
          .where(eq(conversations.id, sessionId));
      }
    }

    console.log(`✅ DB: メッセージ保存完了 ${messageId}`); // デバッグログ追加

    return {
      id: messageId,
      role,
      content,
      timestamp: now,
    };
  }
}
