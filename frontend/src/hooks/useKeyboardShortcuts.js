import { useEffect } from 'react';

export function useKeyboardShortcuts({
  undo,
  redo,
  removePage,
  rotatePage,
  selectedPageId,
  exportDocument,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable)
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            redo?.();
          } else {
            undo?.();
          }
        } else if (event.key.toLowerCase() === 's') {
          event.preventDefault();
          exportDocument?.();
        }
      } else {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (selectedPageId) {
            event.preventDefault();
            if (window.confirm('Are you sure you want to delete this page?')) {
              removePage?.(selectedPageId);
            }
          }
        } else if (event.key.toLowerCase() === 'r') {
          if (selectedPageId) {
            event.preventDefault();
            rotatePage?.(selectedPageId);
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, removePage, rotatePage, selectedPageId, exportDocument]);
}
