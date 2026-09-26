"use server";

import { revalidatePath } from "next/cache";
import { requirePilot } from "@/lib/gate";
import { deleteDeployment, rollbackApp, RouterError } from "@/lib/router";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function removeDeployment(id: string): Promise<ActionResult> {
  const user = await requirePilot();
  const key = user.key;

  try {
    await deleteDeployment(key.token, id);
  } catch (error) {
    const message =
      error instanceof RouterError
        ? `router refused the delete (${error.status})`
        : "could not reach the router";
    return { ok: false, error: message };
  }

  revalidatePath("/apps");
  revalidatePath("/usage");
  return { ok: true };
}

export async function rollbackRevision(id: string, revision: string): Promise<ActionResult> {
  const user = await requirePilot();
  if (!/^[a-f0-9]{32}$/.test(id) || !/^[a-f0-9]{32}$/.test(revision)) {
    return { ok: false, error: "invalid app or revision" };
  }
  try {
    await rollbackApp(user.key.token, id, revision);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof RouterError ? `router refused rollback (${error.status})` : "could not reach the router",
    };
  }
  revalidatePath(`/apps/${id}`);
  revalidatePath("/apps");
  revalidatePath("/usage");
  return { ok: true };
}
