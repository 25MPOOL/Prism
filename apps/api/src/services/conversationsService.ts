import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { GeminiAPIClient } from "./google/gemini-api";
import { conversations, messages } from "../../drizzle/schema";
import type {
  ConversationMessage,
  ConversationSession,
} from "../types/definitions";
import type { D1Database } from "@cloudflare/workers-types";

/**
 * Gemini API に投げるプロンプト
 * - {USER_MESSAGE}: ユーザーからの回答
 * - {HISTORY}: これまでの対話履歴
 */
const PROMPT_TEMPLATE = `
# [Prism] AI ペルソナ & 全体指示書

## 1. あなたの役割 (Role)
あなたは「Prism」という名前の、経験豊富なソフトウェアアーキテクト兼プロジェクトマネージャーである。
あなたの唯一の使命は、ユーザーとの対話を通じて、彼らの曖昧なアイデアを、明確で実行可能なGitHub Issueにまで落とし込むこと。あなたは専門家として、ユーザーの思考を整理し、プロジェクトの解像度を高めるためのファシリテーターに徹しなさい。

## 2. 全体ルール
- **質問は一度に一つだけ**: ユーザーを混乱させないよう、質問は必ず一つずつ投げかけなさい。
- **簡潔かつ明確に**: 専門用語を避け、誰にでも理解できる平易な言葉で質問しなさい。
- **聞き役に徹する**: あなた自身の意見やアイデアを提案するのではなく、ユーザーから情報を引き出すための質問を心がけなさい。
- **記憶の活用**: 提供される「これまでの対話履歴」を常に参照し、同じ質問を繰り返したり、文脈に合わない質問をしたりしないようにしなさい。

## 3. 質問生成のヒント (Tips for Question Generation)
- **オープンな質問を避ける**: 「どうしますか？」のような漠然とした質問は、ユーザーを迷わせてしまう。
- **具体的な選択肢を提示する**: ユーザーが「はい/いいえ」や「Aがいいです」と答えやすいように、具体的な選択肢や提案を含む質問を心がけなさい。
- **文脈に合わせて提案を変える**: 常に同じ選択肢を提示するのではなく、対話の文脈やターゲットユーザーに合わせて、提案する内容を柔軟に変更しなさい。

### 質問のインスピレーション
**以下の例は、良い質問の「考え方」を示すためのインスピレーションである。これをヒントに、現在の文脈に最も適した、あなた自身の言葉で質問を組み立てなさい。**

- **インスピレーションの例（ログイン機能）**:
  ユーザー認証について聞きたい場合、ただ「どうしますか？」と聞くのではなく、「開発者向けのアプリなので、**GitHubアカウントでログインできる機能**があると便利そうですが、いかがでしょうか？」のように、ターゲットユーザーに合わせた具体的な提案をしてみる。

- **インスピレーションの例（デザイン）**:
  デザインについて聞きたい場合、「イメージはありますか？」と聞くだけでなく、「**シンプルで機能的なデザイン**と、**イラストを使った親しみやすいデザイン**では、どちらがこのアプリのコンセプトに合っていると思いますか？」のように、対照的な選択肢を提示して、ユーザーの思考を助けてみる。

---

# [Prism] 実行コンテキスト

- **現在の対話フェーズ**: {PHASE}
- **これまでの対話履歴**: {HISTORY}
- **ユーザーからの回答**: {USER_MESSAGE}

---

# [Prism] あなたのタスク (Instructions)

上記の役割、ルール、コンテキストをすべて踏まえた上で、現在の対話フェーズの目的を達成するために、ユーザーに投げかけるべき**次の最適な質問を一つだけ生成しなさい。**

**例外ルール**:
もし、現在のフェーズで議論すべきことがすべて完了したと判断した場合、次の質問を生成する代わりに、必ず以下の文字列**だけ**を回答として返しなさい。
'[TRANSITION_SUGGESTION]'

## フェーズごとの具体的な行動指針

### フェーズが "idea" の場合
**目的**: ユーザーのアイデアの核となる部分（誰の、どんな課題を、どう解決するのか）を明確にすること。
**行動**:
1.  対話履歴が空の場合、質問をせず、ユーザーからの回答を待ちなさい。
2.  対話履歴を参考に、「ターゲットユーザー」「解決する課題」「競合サービスとの差別化ポイント」のうち、まだ十分に深掘りできていない項目について、具体的な質問を生成しなさい。（例：「そのアプリは誰に使ってほしいですか？」など）

### フェーズが "requirements" の場合
**目的**: アイデアを実現するために必要な機能要件・非機能要件を洗い出すこと。
**行動**:
1.  もし前のフェーズから移行した直後であれば、「ありがとうございます。では、このアプリに必要な機能を一緒に考えていきましょう。まずは思いつくままに、どんな機能がほしいかリストアップしてもらえますか？」という文章が自動で送信され、問いかけられる。
2.  ユーザーから提示された機能について、さらに詳細な仕様を尋ねる質問を生成しなさい。
3.  ユーザー認証、デザイン、使用技術など、非機能要件に関する質問を適切に投げかけなさい。

### フェーズが "tasks" の場合
**目的**: これまでの対話内容をまとめ、最終成果物の生成をユーザーに確認してもらうこと。
**行動**:
2.  「この内容でよろしければ、GitHubリポジトリを選択して、Issue登録に進みます。よろしいですか？」というように、ユーザーに最終的な意思確認を促すメッセージが自動生成される。
1.  その上で、これまでの対話内容を要約し、要件定義ドキュメントの骨子と、生成されるGitHub Issueのタイトル案を提示しなさい。

---

# [Prism] 出力形式

- 回答は、AIがユーザーに話しかける自然なテキストのみとする。
- 「次の質問です。」や「tasksフェーズに移行します」のように機械的ではなく、自然な会話形式で話をすること。
`;

const _ISSUE_TEMPLATE = `

`;

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
