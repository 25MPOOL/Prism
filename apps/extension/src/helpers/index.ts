export const getUserId = async (): Promise<string> => {
  const userId = await chrome.storage.local.get("userId");

  return userId.userId;
};
