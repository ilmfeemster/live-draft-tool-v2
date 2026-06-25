"use server";

import type { DraftWorkspace } from "@/types/draft";
import {
  draftPlayerInWorkspace,
  undoLastPickInWorkspace,
} from "@/lib/draftRepository";

export async function draftPlayerAction(
  draftId: string,
  playerId: string,
): Promise<DraftWorkspace | null> {
  if (!draftId.trim() || !playerId.trim()) {
    return null;
  }

  return draftPlayerInWorkspace(draftId, playerId);
}

export async function undoLastPickAction(
  draftId: string,
): Promise<DraftWorkspace | null> {
  if (!draftId.trim()) {
    return null;
  }

  return undoLastPickInWorkspace(draftId);
}
