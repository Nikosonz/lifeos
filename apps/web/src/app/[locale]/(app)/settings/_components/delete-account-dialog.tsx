"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Deliberately NOT the shared ConfirmDeleteDialog.
 *
 * That dialog guards deleting a wallet or a task — one row, recreatable in
 * seconds, and a single click of confirmation is proportionate. This one
 * destroys the account and every row it owns, permanently, with no recovery
 * window. A one-click confirm is the wrong weight for an action whose
 * failure mode is unrecoverable, so the user has to type the confirmation
 * word before the button enables.
 *
 * The word comes from the translation file rather than being hardcoded
 * English — asking a Persian-speaking user to type "DELETE" to prove intent
 * tests their keyboard layout, not their intent.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const t = useTranslations("Settings");
  const [typed, setTyped] = useState("");

  // Reset per open, so a previous session's typed word can't leave the
  // button pre-armed the next time the dialog appears.
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const requiredWord = t("deleteAccountConfirmWord");
  const canDelete = typed.trim() === requiredWord && !pending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteAccountTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteAccountWarning")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-confirm">{t("deleteAccountPrompt", { word: requiredWord })}</Label>
          <Input
            id="delete-confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              // AlertDialogAction closes the dialog on click by default,
              // which would dismiss it mid-request and hide the pending
              // state. The parent closes it once the mutation settles.
              e.preventDefault();
              onConfirm();
            }}
          >
            {t("deleteAccountConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
