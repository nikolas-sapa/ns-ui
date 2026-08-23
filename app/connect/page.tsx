import type { Metadata } from "next";
import { CopyButton } from "../_components/copy-button";
import { AskAI } from "../_components/ask-ai";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { getMcpClients } from "./mcp-clients";
import { ClientSwitcher } from "./client-switcher";

export const metadata: Metadata = {
  alternates: { canonical: "/connect" },
  title: "Connect — ns-ui",
  description:
    "Pull the ns-ui registry into an agent: an MCP server, a CLI, and the raw llms.txt feeds.",
};

const CLI_SEARCH = 'npx @nikolas.sapa/ns-ui search "reactive hero"';
const CLI_INFO = "npx @nikolas.sapa/ns-ui info undo-ghost-row";
const CLI_INSTALL = "npx @nikolas.sapa/ns-ui add <name> [...names]";

const SECTION_LABEL =
  "font-mono text-xs uppercase tracking-[0.14em] text-foreground";

const CODE_BLOCK =
  "flex items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5";

export default function ConnectPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
          ns-ui / connect
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          Get the registry into an agent.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ns-muted">
          Three ways in: an MCP server for tools an agent can call mid-task, a CLI for
          finding, inspecting and installing from a terminal, and the raw text feeds for
          anything that just reads.
        </p>
      </header>

      <section className="mt-16">
        <h2 className={SECTION_LABEL}>MCP server</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Five tools: search the catalog, get one component&apos;s full detail and real
          source, list categories, get the install command, and get the design-token
          conventions the components are built against. Ships a static snapshot of the
          registry, so it works once installed from npm without a live connection back to
          this site.
        </p>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          Add to your MCP client
        </p>
        <div className="mt-2">
          <ClientSwitcher clients={getMcpClients()} />
        </div>
        <p className="mt-3 text-xs text-ns-muted">Requires Node 18+.</p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>CLI</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Finds and inspects components from a terminal, not just installs them: search
          narrows the catalog by name, description, tags and use-when guidance; info prints
          one component&apos;s props, dependencies and install command. add installs by
          delegating to <code className="font-mono text-foreground">shadcn add</code>, once
          per name, and fails fast with a "did you mean" on a typo instead of handing it to
          shadcn. Reads from a local cache first and a bundled snapshot if the network is
          down, so it still works offline.
        </p>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          Find one
        </p>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {CLI_SEARCH}
          </code>
          <CopyButton variant="inline" value={CLI_SEARCH} label="Copy search command" />
        </div>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          Read its props and install command
        </p>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {CLI_INFO}
          </code>
          <CopyButton variant="inline" value={CLI_INFO} label="Copy info command" />
        </div>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          Install it
        </p>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {CLI_INSTALL}
          </code>
          <CopyButton variant="inline" value={CLI_INSTALL} label="Copy install command" />
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Also: <code className="font-mono text-foreground">list</code>,{" "}
          <code className="font-mono text-foreground">categories</code>, and{" "}
          <code className="font-mono text-foreground">mcp</code> (prints the MCP config block
          above). Full command reference:{" "}
          <a
            href="https://github.com/nikolas-sapa/ns-ui/blob/main/cli/README.md"
            className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            cli/README.md
          </a>
          .
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ns-muted">
          If <code className="font-mono text-foreground">npx</code> refuses either package with
          "No versions available", that's npm's own{" "}
          <code className="font-mono text-foreground">minimum-release-age</code> setting on your
          machine (a supply-chain policy some orgs and individuals set) rejecting a package
          published within that window, not a problem with the package itself. Wait out the
          window or override the policy locally.
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>Text feeds</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          For anything that just reads rather than calls tools:{" "}
          <a
            href="/llms.txt"
            className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            /llms.txt
          </a>{" "}
          is the catalog index, and{" "}
          <a
            href="/llms-full.txt"
            className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            /llms-full.txt
          </a>{" "}
          adds a condensed prop signature and usage guidance per component. Both are
          generated from the same registry data as the MCP server and the site itself, so
          none of the three can drift from another.
        </p>

        {/* The links above stay plain, inline prose — a copy affordance mid-
            sentence would either crowd the surrounding text (icon-sized) or
            overwhelm it (prose-sized, meant for a block's own corner). Same
            URLs, same site convention as the CLI commands above: a labelled
            block row instead. */}
        <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          Feed URLs
        </p>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {REGISTRY_ORIGIN}/llms.txt
          </code>
          <CopyButton
            variant="inline"
            value={`${REGISTRY_ORIGIN}/llms.txt`}
            label="Copy llms.txt URL"
          />
        </div>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {REGISTRY_ORIGIN}/llms-full.txt
          </code>
          <CopyButton
            variant="inline"
            value={`${REGISTRY_ORIGIN}/llms-full.txt`}
            label="Copy llms-full.txt URL"
          />
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Every install command resolves against{" "}
          <code className="font-mono text-foreground">{REGISTRY_ORIGIN}</code>.
        </p>

        <div className="mt-8">
          <AskAI />
        </div>
      </section>
    </main>
  );
}
