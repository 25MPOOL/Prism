// 拡張機能アイコンクリックでサイドパネルを開く設定
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// `START_GITHUB_OAUTH` メッセージを受けて認証フローを開始する
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type !== "START_GITHUB_OAUTH") return;

  try {
    const GITHUB_CLIENT_ID = "Iv23liYYgijGAuZfFd51";

    // GitHubの認証ページURLを直接組み立てる
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.append("client_id", GITHUB_CLIENT_ID);
    authUrl.searchParams.append(
      "redirect_uri",
      chrome.identity.getRedirectURL(),
    );
    authUrl.searchParams.append("scope", "repo,read:org");

    // 認証ウィンドウを開き、最終的なリダイレクトURLを待つ
    const finalRedirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.href,
      interactive: true,
    });

    if (!finalRedirectUrl) {
      return { ok: false, error: "User cancelled." };
    }

    // URLから認証コード`code`を抜き出す
    const code = new URL(finalRedirectUrl).searchParams.get("code");
    if (!code) {
      throw new Error("Could not find 'code' in redirect URL.");
    }

    // Honoバックエンドの /exchange エンドポイントにcodeをPOSTする
    const backendUrl =
      "https://prism-api.kaitomichigan22.workers.dev/github/exchange";
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Backend exchange failed.");
    }

    console.log("Backend exchange successful. Login complete.");
    await chrome.storage.local.set({ isLoggedIn: true });
    return { ok: true };
  } catch (error) {
    console.error("OAuth flow failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
