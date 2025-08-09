import { memo, useCallback } from "react";
import { IconSignOut } from "@/components/ui/IconSignOut";

interface DropDownMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DropDownMenu = memo((props: DropDownMenuProps) => {
  const { isOpen, onClose } = props;

  /**
   * ドロップダウンメニューを閉じる
   */
  const _handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 animate-drop-down-menu rounded-xl bg-[#2a313c] shadow-drop-down">
          <ul className="list-none py-2">
            <li className="mx-2 rounded-md border-transparent duration-75 hover:bg-[#656c7626]">
              <button
                type="button"
                onClick={_handleClose}
                className="flex flex-row gap-2 px-2 py-1.5"
              >
                {/* アイコン */}
                <div className="flex items-center justify-center">
                  <IconSignOut />
                </div>
                {/* テキスト */}
                <div className="flex w-full items-center justify-start">
                  <p className="text-[#d1d7e0]">Sign out</p>
                </div>
              </button>
            </li>
          </ul>
        </div>
      )}
    </>
  );
});
