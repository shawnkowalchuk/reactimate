import { Plus } from "lucide-react";
import type { Component } from "../../types/project";
import { useProjectStore } from "../../store/projectStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { useSelectionStore } from "../../store/selectionStore";
import { EFFECT_DEFAULTS } from "../../constants/effects";

interface AddEffectMenuProps {
  component: Component;
  projectDuration: number;
}

/**
 * Adds a default Fade effect inline to the component at the current
 * playhead. The user changes the effect type later via the gear icon on
 * each block → EffectModal's Type dropdown.
 */
export function AddEffectMenu({ component, projectDuration }: AddEffectMenuProps) {
  const addEffect = useProjectStore((s) => s.addEffect);
  const selectEffect = useSelectionStore((s) => s.selectEffect);

  const onAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Add a blank ("custom") effect by default — the user picks the
    // actual type via the Type dropdown in the EffectModal.
    const defaults = EFFECT_DEFAULTS.custom;
    const requested = usePlaybackStore.getState().currentTime;
    const maxStart = Math.max(0, projectDuration - defaults.duration);
    const startTime = Math.min(Math.max(0, requested), maxStart);
    const id = addEffect(component.id, "custom", startTime);
    if (id) selectEffect(component.id, id);
  };

  return (
    <button
      type="button"
      onClick={onAdd}
      title="Add a blank effect (pick the type via the pencil on the block)"
      aria-label="Add effect"
      className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
    >
      <Plus size={12} />
    </button>
  );
}
