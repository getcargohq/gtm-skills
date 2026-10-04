"use client";

import type { FormInstance } from "@cargo-ai/form-sdk";
import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

// The website's demo form, rendered with the site's own markup and run
// headless through Cargo's form SDK. Submitting runs the `inbound_form` tool's
// workflow, and the answer (a booking link or a thank-you) comes back in the
// same request.
//
// The SDK loads on the visitor's first focus, not with the page: it sets a
// first-party id cookie and captures the page's UTMs when it loads, and a
// visitor who never touches the form should leave with neither. It also starts
// the server's minimum-fill timer from that moment, which is when filling
// actually starts.
//
// NEXT_PUBLIC_CARGO_FORM is the tool's uuid, the app env token
// `inboundForm.uuid`. It is public: the form API only accepts the origins the
// tool allows.

type Answer =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "qualified"; bookingUrl: string }
  | { kind: "thanks" }
  | { kind: "work_email" }
  | { kind: "error" };

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function InboundForm() {
  const toolUuid = process.env.NEXT_PUBLIC_CARGO_FORM;
  const form = useRef<Promise<FormInstance> | null>(null);
  const [answer, setAnswer] = useState<Answer>({ kind: "idle" });

  if (toolUuid === undefined || toolUuid === "") {
    return null;
  }

  const load = (): Promise<FormInstance> => {
    if (form.current === null) {
      form.current = import("@cargo-ai/form-sdk").then(({ loadForm }) =>
        loadForm(toolUuid, { render: "headless", mode: "sync" }),
      );
    }
    return form.current;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setAnswer({ kind: "sending" });
    try {
      const instance = await load();
      instance.setValues({
        email: String(data.get("email")),
        first_name: String(data.get("first_name")),
        last_name: String(data.get("last_name")),
        message: String(data.get("message")),
        consent: data.get("consent") === "on",
      });
      instance.onError(() => setAnswer({ kind: "error" }));
      instance.onSuccess((_values, response) => {
        const output =
          response.outcome === "completed"
            ? (response.result.output as {
                status?: string;
                bookingUrl?: string;
              } | null)
            : null;
        if (output !== null && output.status === "work_email_required") {
          setAnswer({ kind: "work_email" });
        } else if (
          output !== null &&
          output.status === "qualified" &&
          typeof output.bookingUrl === "string"
        ) {
          setAnswer({ kind: "qualified", bookingUrl: output.bookingUrl });
        } else {
          setAnswer({ kind: "thanks" });
        }
        return false;
      });
      await instance.submit();
    } catch {
      setAnswer({ kind: "error" });
    }
  };

  if (answer.kind === "qualified") {
    return (
      <div role="status" className="space-y-4 rounded-lg border p-6">
        <p className="text-lg font-medium">Thanks, let&apos;s find a time.</p>
        <Button asChild>
          <a href={answer.bookingUrl}>Book a demo</a>
        </Button>
      </div>
    );
  }

  if (answer.kind === "thanks") {
    return (
      <div role="status" className="rounded-lg border p-6">
        <p className="text-lg font-medium">
          Thanks, we&apos;ll be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      onFocus={() => void load()}
      className="max-w-xl space-y-4"
      noValidate={false}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>First name</span>
          <input name="first_name" required className={inputClass} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Last name</span>
          <input name="last_name" required className={inputClass} />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span>Work email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          aria-describedby={
            answer.kind === "work_email" ? "work-email-hint" : undefined
          }
        />
      </label>
      {answer.kind === "work_email" ? (
        <p id="work-email-hint" role="alert" className="text-sm">
          Please use your work email, so we know which company you are with.
        </p>
      ) : null}
      <label className="block space-y-1 text-sm">
        <span>What would you like to see?</span>
        <textarea name="message" rows={4} className={inputClass} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="consent" type="checkbox" className="mt-1" />
        <span>I agree to receive product news by email.</span>
      </label>
      {answer.kind === "error" ? (
        <p role="alert" className="text-sm">
          Something went wrong. Please try again in a minute.
        </p>
      ) : null}
      <Button type="submit" disabled={answer.kind === "sending"}>
        {answer.kind === "sending" ? "Sending" : "Request a demo"}
      </Button>
    </form>
  );
}
