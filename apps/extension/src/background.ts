// 拡張機能のアイコンがクリックされた時の処理
chrome.action.onClicked.addListener(async (tab) => {
  // 現在のウィンドウでサイドパネルを開く
  if (tab.windowId) {
    await chrome.sidePanel.open({
      windowId: tab.windowId,
    });
  }
});
