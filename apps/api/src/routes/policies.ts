import { Hono } from "hono";
import type { AppEnv } from "../types/definitions";

const policies = new Hono<{ Bindings: AppEnv }>();

// プライバシーポリシー
policies.get("/", async (c) => {
  const privacyPolicy = `# プライバシーポリシー

最終更新日: ${new Date().toLocaleDateString("ja-JP")}

## 1. 収集する情報

### 1.1 GitHubアカウント情報
- ユーザー名、メールアドレス、プロフィール情報
- GitHubリポジトリへのアクセス権限

### 1.2 利用状況データ
- 会話履歴、セッション情報
- 利用時間、操作ログ

## 2. Cookieについて

### 2.1 使用するCookie
| Cookie名 | 目的 | 有効期限 | 属性 |
|----------|------|----------|------|
| prism_uid | ユーザー認証・識別 | 30日 | HttpOnly, Secure, SameSite=None |

### 2.2 Cookie設定
- **SameSite=None**: Chrome拡張からAPIへのクロスサイト通信のため
- **Secure**: HTTPS通信でのみ送信
- **HttpOnly**: JavaScript読取不可（セキュリティ強化）

## 3. 情報の利用目的
- サービス提供および機能改善
- ユーザー認証とセッション管理
- 会話履歴の保存と表示
- GitHub連携機能の提供

## 4. 情報の共有・開示
第三者への提供は行いません。ただし以下の場合を除きます：
- 法的義務がある場合
- ユーザーの明示的同意がある場合

## 5. データ保存期間
- **会話データ**: アカウント削除まで
- **認証情報**: 最終ログインから30日間
- **Cookie**: 30日間（手動削除も可能）

## 6. Cookie管理方法

### 6.1 削除方法
1. 拡張機能画面右上のアイコンをクリック
2. ログアウトを選択

### 6.2 無効化
ブラウザ設定でCookie無効化可能ですが、サービス利用に支障が生じます。

## 7. お問い合わせ
プライバシーやCookieに関するご質問は、(https://github.com/25MPOOL/Prism)のIssueまでお願いします。

## 8. ポリシー変更
本ポリシーの変更時は、このページで通知いたします。
`;

  return c.text(privacyPolicy, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
  });
});

export { policies };
