import { memo, useCallback } from "react";

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
        <div className="absolute top-full right-0 mt-2 w-48 rounded-md bg-white shadow-lg">
          <ul className="divide-y divide-gray-100">
            <li className="px-4 py-2">Logout</li>
          </ul>
        </div>
      )}
    </>
  );
});
