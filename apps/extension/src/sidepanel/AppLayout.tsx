import { DropDownMenu } from "@/components/DropDownMenu";
import { IconClock } from "@/components/ui/IconClock";
import { IconPlus } from "@/components/ui/IconPlus";
import { IconShare } from "@/components/ui/IconShare";
import { useGetProfile } from "@/hooks/api/getProfile";
import { userKeys } from "@/hooks/api/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = (props: AppLayoutProps) => {
  const { children } = props;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { fetchProfile } = useGetProfile();
  const { data: profile } = useQuery({
    queryKey: userKeys.profile(),
    queryFn: () => fetchProfile(),
  });

  /**
  /**
   * ドロップダウンメニューをトグルする
   */
  const handleDropdownToggle = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex w-full items-center justify-between gap-3 bg-[#151b23] p-4 shadow-inner-bottom">
        <h1 className="font-bold text-xl">Prism</h1>
        <div className="flex items-center gap-2">
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d] duration-75 hover:bg-[#656c7626]"
            type="button"
          >
            <IconPlus />
          </button>
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d] duration-75 hover:bg-[#656c7626]"
            type="button"
          >
            <IconClock />
          </button>
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d] duration-75 hover:bg-[#656c7626]"
            type="button"
          >
            <IconShare />
          </button>
          <div className="relative">
            <button
              className="h-8 w-8 rounded-full border border-[#3d444d]"
              type="button"
              onClick={handleDropdownToggle}
            >
              <img
                src={profile?.user.avatarUrl}
                alt={profile?.user.name}
                className="h-full w-full rounded-full"
              />
            </button>
            <DropDownMenu
              isOpen={isDropdownOpen}
              onClose={handleDropdownToggle}
            />
          </div>
        </div>
      </header>
      <main className="flex min-h-0 grow flex-col">{children}</main>
    </div>
  );
};
