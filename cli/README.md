# @nikolas.sapa/ns-ui

CLI for the [ns-ui](https://design.helpmarq.com) component registry. A thin
wrapper around `shadcn add` that shortens the install command.

## Install

No install needed, run directly with `npx`:

```
npx @nikolas.sapa/ns-ui <command>
```

## Commands

### add

```
npx @nikolas.sapa/ns-ui add <name> [...names]
```

Installs one or more components by delegating to `npx shadcn@latest add
https://design.helpmarq.com/r/<name>.json`.

### list

```
npx @nikolas.sapa/ns-ui list [--collection core|loud]
```

Prints every component name and title. Filter by collection with
`--collection`.

### search

```
npx @nikolas.sapa/ns-ui search <term>
```

Searches component names, titles, and descriptions for a term.

## Links

- [Registry](https://design.helpmarq.com)
- [Source](https://github.com/nikolas-sapa/ns-ui)
