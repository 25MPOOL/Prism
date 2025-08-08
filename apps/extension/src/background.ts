// 拡張機能アイコンクリックでサイドパネルを開く設定
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// インストール時やタブ切り替え時にサイドパネルを有効にする
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
});
chrome.tabs.onActivated.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
});

// `START_GITHUB_OAUTH` メッセージを受けて認証フローを開始する
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type !== "START_GITHUB_OAUTH") {
    return;
  }

  try {
    const baseUrl = "https://prism-api.kaitomichigan22.workers.dev/";

    // 認証完了後にHonoバックエンドがリダイレクトする先のURL（拡張機能内の仮想URL）
    const extensionRedirectUrl = chrome.identity.getRedirectURL();

    // Honoバックエンドに、認証後の戻り先として拡張機能のURLを伝える
    const initialAuthUrl = `${baseUrl}github/oauth?extRedirect=${encodeURIComponent(
      extensionRedirectUrl,
    )}`;

    // 認証ウィンドウを開き、最終的なリダイレクトURLを待つ
    const finalRedirectUrl = await chrome.identity.launchWebAuthFlow({
      url: initialAuthUrl,
      interactive: true,
    });

    // 最終URLに成功フラグが含まれているかチェック
    const isSuccess = finalRedirectUrl?.includes("#success=1");

    if (isSuccess) {
      console.log("OAuth flow completed successfully.");
      await chrome.storage.local.set({ isLoggedIn: true });

      // 現在アクティブなタブでサイドパネルを再度開く
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (activeTab?.id) {
        await chrome.sidePanel.open({ tabId: activeTab.id });
      }
    } else {
      console.warn(
        "OAuth flow did not complete successfully.",
        finalRedirectUrl,
      );
    }
    // 応答を返す
    return { ok: isSuccess };
  } catch (error) {
    console.error("launchWebAuthFlow failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
