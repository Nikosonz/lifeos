"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// One reusable "how does this page work" affordance, placed in every
// module page's header row — content is looked up from the HelpGuide
// namespace by `pageKey` (e.g. "finance", "calendar") rather than each page
// building its own dialog. `data-tour="page-help"` is also the first-run
// OnboardingTour's target for its "per-page help" step — since only one
// page is mounted at a time, that single attribute value is enough for the
// tour's document.querySelector to find whichever page happens to be open.
export function PageHelp({ pageKey }: { pageKey: string }) {
  const t = useTranslations("HelpGuide");
  const [open, setOpen] = useState(false);
  const items = t.raw(`${pageKey}.items`) as string[];

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        data-tour="page-help"
        aria-label={t(`${pageKey}.title`)}
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(`${pageKey}.title`)}</DialogTitle>
          </DialogHeader>
          <ul className="text-muted-foreground list-inside list-disc space-y-2 text-sm">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
