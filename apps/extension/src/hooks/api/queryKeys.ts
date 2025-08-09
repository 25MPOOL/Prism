export const repositoryKeys = {
  all: ["repositories"] as const,
  lists: () => [...repositoryKeys.all, "list"] as const,
};
