"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/components/utils";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        // The indicator's fill direction below is a JS translateX (a
        // physical transform, not a CSS logical property, so `dir` alone
        // doesn't flip it) — mirroring the whole root horizontally in RTL
        // is a correct, zero-JS fix specifically because this bar has no
        // text/icon content that mirroring would otherwise garble.
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20 rtl:scale-x-[-1]",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
