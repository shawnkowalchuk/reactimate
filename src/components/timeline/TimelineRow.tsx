import type { Component } from "../../types/project";
import { EffectBlock } from "./EffectBlock";
import { ROW_HEIGHT } from "./timelineMath";

interface TimelineRowProps {
  component: Component;
  pxPerSecond: number;
  duration: number;
}

export function TimelineRow({ component, pxPerSecond, duration }: TimelineRowProps) {
  return (
    <div
      className="relative border-b border-neutral-800"
      style={{ height: ROW_HEIGHT }}
    >
      {component.effects.map((eff) => (
        <EffectBlock
          key={eff.id}
          component={component}
          effect={eff}
          pxPerSecond={pxPerSecond}
          duration={duration}
        />
      ))}
    </div>
  );
}
