"use server";

const EMAILOCTOPUS_API = "https://api.emailoctopus.com";

export type SubscribeState = {
  status: "idle" | "success" | "error";
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Subscribes an email to the EmailOctopus list. Reads its env vars inside
 * the action body (not at module scope) so a missing key surfaces as a
 * normal error state on submit, not a build- or render-time throw — the
 * owner has not provisioned keys yet, and this route still needs to render.
 *
 * `honeypot` is a hidden field real visitors never see or fill. A bot that
 * fills it gets the success state without an API call, so the response
 * teaches it nothing about what tripped it.
 */
export async function subscribe(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const email = String(formData.get("email") ?? "").trim();
  const honeypot = String(formData.get("company") ?? "").trim();

  if (honeypot) {
    return { status: "success", message: "You're on the list." };
  }

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "That doesn't look like a valid email." };
  }

  const apiKey = process.env.EMAILOCTOPUS_API_KEY;
  const listId = process.env.EMAILOCTOPUS_LIST_ID;

  if (!apiKey || !listId) {
    return {
      status: "error",
      message: "Email signup isn't configured yet — try again later.",
    };
  }

  try {
    const res = await fetch(`${EMAILOCTOPUS_API}/lists/${listId}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email_address: email, status: "subscribed" }),
    });

    // 201 = created. 409 = the contact already exists on this list — from
    // the visitor's side that's the same outcome as subscribing, so it's
    // reported as success rather than surfaced as a conflict.
    if (res.status === 201 || res.status === 409) {
      return { status: "success", message: "You're on the list." };
    }

    // EmailOctopus's `detail` string can carry account/plan context (401/403)
    // or field-level specifics (400/422) that aren't for a visitor to see, so
    // the response body is never forwarded to the client — only a fixed
    // message keyed off the status.
    if (res.status === 400 || res.status === 422) {
      return { status: "error", message: "That doesn't look like a valid email." };
    }

    return { status: "error", message: "Something went wrong — try again in a moment." };
  } catch {
    return { status: "error", message: "Network error — try again in a moment." };
  }
}
