import { IconClock } from "@/components/ui/IconClock";
import { IconPlus } from "@/components/ui/IconPlus";
import { IconShare } from "@/components/ui/IconShare";
import { useGetProfile } from "@/hooks/api/getProfile";
import { userKeys } from "@/hooks/api/queryKeys";
import { useQuery } from "@tanstack/react-query";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = (props: AppLayoutProps) => {
  const { children } = props;

  const { fetchProfile } = useGetProfile();
  const { data: profile } = useQuery({
    queryKey: userKeys.profile(),
    queryFn: () => fetchProfile(),
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex w-full items-center justify-between gap-3 bg-[#151b23] p-4 shadow-inner-bottom">
        <h1 className="font-bold text-xl">Prism</h1>
        <div className="flex items-center gap-2">
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d]"
            type="button"
          >
            <IconPlus />
          </button>
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d]"
            type="button"
          >
            <IconClock />
          </button>
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d]"
            type="button"
          >
            <IconShare />
          </button>
          <button
            className="h-8 w-8 rounded-full border border-[#3d444d]"
            type="button"
          >
            <img
              src={profile?.user.avatarUrl}
              alt={profile?.user.name}
              className="h-full w-full rounded-full"
            />
          </button>
        </div>
      </header>
      <main className="flex min-h-0 grow flex-col">{children}</main>
    </div>
  );
};
