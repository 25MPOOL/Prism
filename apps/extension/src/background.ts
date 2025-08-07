// 拡張機能のアイコンがクリックされた時の処理
chrome.action.onClicked.addListener(async (tab) => {
  // 現在のウィンドウでサイドパネルを開く
  if (tab.windowId) {
    await chrome.sidePanel.open({
      windowId: tab.windowId,
    });
  }
});

// キーボードショートカットが実行された時の処理
chrome.commands.onCommand.addListener(async (command) => {
  // ショートカットキーが "_execute_action" に設定されているか確認
  if (command === "_execute_action") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.windowId) {
      await chrome.sidePanel.open({
        windowId: tab.windowId,
      });
    }
  }
});
