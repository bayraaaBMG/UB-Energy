import { useState, useCallback } from "react";

/**
 * Inline confirmation state — returns a pending item and two handlers.
 * Usage:
 *   const { confirmId, ask, confirm, cancel } = useConfirm();
 *   ask(item.id)        → sets confirmId = item.id
 *   confirm()           → calls onConfirm(confirmId), clears state
 *   cancel()            → clears state
 */
export function useConfirm() {
  const [confirmId, setConfirmId] = useState(null);

  const ask    = useCallback((id) => setConfirmId(id), []);
  const cancel = useCallback(() => setConfirmId(null), []);
  const confirm = useCallback((onConfirm) => {
    if (confirmId !== null) onConfirm(confirmId);
    setConfirmId(null);
  }, [confirmId]);

  return { confirmId, ask, confirm, cancel };
}
