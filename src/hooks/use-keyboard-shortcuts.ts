import { useEffect } from "react";

export function useKeyboardShortcuts({
  cypher,
  execute,
  saveQuery,
  setShortcutsOpen,
  clearAll,
}: {
  cypher: string;
  execute: (query: string) => Promise<void>;
  saveQuery: () => void;
  setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clearAll: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void execute(cypher);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveQuery();
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyC") {
        event.preventDefault();
        clearAll();
      }
      if (event.key === "Escape") setShortcutsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cypher, execute, saveQuery, setShortcutsOpen, clearAll]);
}
