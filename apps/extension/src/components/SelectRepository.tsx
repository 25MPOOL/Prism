import { useGetRepos, type Repository } from "@/hooks/api/getRepos";
import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { repositoryKeys } from "@/hooks/api/queryKeys";

interface SelectRepositoryProps {
  defaultSelectedIds?: string[];
  onCancel?: () => void;
  onConfirm?: (selected: Repository[]) => void;
}

export const SelectRepository = memo((props: SelectRepositoryProps) => {
  const { defaultSelectedIds, onCancel, onConfirm } = props;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { fetchRepos } = useGetRepos();
  const { data: repository } = useQuery({
    queryKey: repositoryKeys.lists(),
    queryFn: () => fetchRepos(),
  });

  useEffect(() => {
    if (defaultSelectedIds?.length) {
      setSelected(new Set(defaultSelectedIds));
    }
  }, [defaultSelectedIds]);

  // フィルタリングロジック。reposがundefinedの場合も考慮して空配列をデフォルト値にする
  const filtered = useMemo(() => {
    const list = repository ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [query, repository]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#262c3666] px-4">
      <div className="-outline-offset-1 w-full max-w-xl rounded-xl border border-[#3d444d] bg-[#262c36] shadow-2xl outline-2">
        <div className="flex items-start justify-between gap-4 border-[#21262d] border-b p-4">
          <div>
            <h2 className="font-semibold text-base">リポジトリを選択</h2>
            <p className="mt-1 text-[#8b949e] text-xs">
              Issueを追加するリポジトリを選択してください。
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#30363d] text-[#c9d1d9] hover:bg-[#161b22]"
            onClick={onCancel}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-[#8b949e]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="リポジトリを検索"
              className="w-full rounded-md border border-[#30363d] bg-[#0d1117] py-2 pr-3 pl-9 text-sm outline-none placeholder:text-[#6e7681] focus:border-[#58a6ff]"
            />
          </div>

          <div className="mt-4 max-h-80 overflow-y-auto rounded-md border border-[#30363d]">
            <ul className="divide-y divide-[#21262d]">
              {filtered.map((repo) => {
                const checked = selected.has(repo.id);
                return (
                  <li
                    key={repo.id}
                    className="flex items-center gap-3 p-3 hover:bg-[#161b22]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(repo.id)}
                      className="h-4 w-4 accent-[#58a6ff]"
                    />

                    <img
                      src={repo.avatarUrl}
                      alt="owner avatar"
                      className="h-6 w-6 rounded-full border border-[#30363d]"
                    />

                    <div className="min-w-0 grow">
                      <p className="truncate text-[#c9d1d9] text-sm">
                        {repo.fullName}
                      </p>
                    </div>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="p-6 text-center text-[#8b949e] text-sm">
                  No repositories found
                </li>
              )}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[#8b949e] text-xs">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-[#30363d] px-3 py-1.5 text-sm hover:bg-[#161b22]"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-[#238636] px-3 py-1.5 text-sm text-white hover:bg-[#2ea043] disabled:opacity-60"
                disabled={selected.size === 0}
                onClick={() => {
                  if (!onConfirm || !repository) return;
                  const selectedRepos = repository.filter((repo) =>
                    selected.has(repo.id),
                  );
                  onConfirm(selectedRepos);
                }}
              >
                Select
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
