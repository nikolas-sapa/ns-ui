---
title: "I made my component library readable by agents. Here's what I got wrong first."
date: 2026-07-29
description: "Tags don't separate components that share a category. Writing documentation a machine can read forces a precision that documentation for people lets you skip."
---
I build with coding agents every day. Somewhere around the fiftieth time I watched one pick a component library, I noticed it was always making the same two mistakes.

It would either grab whatever it saw first, or it would invent an API that looked plausible and did not exist. Sometimes both, in the same file.

The obvious explanation is that the model is careless. I don't think that's it. Every component library on the internet is documented for a person who is looking at it. You browse a grid, you see a thing move, you decide. That grid is the interface, and a model reading your docs page gets almost none of what you got from three seconds of looking.

So the model is not choosing badly. It is choosing without the information a human gets for free.

### What a model actually needs

I have a registry of 206 components. Every one of them is one interaction: a switch that eclipses like the sun, a pagination control that folds like a book page, a departure board that clatters through split flaps. Visually they're distinct. In text, half of them collapse into "a button that animates."

The first thing I tried was tags. It didn't work, and the reason is instructive. Tags tell you a category, not a difference. Three of my components are toggle switches. All three are tagged `toggle`, `switch`, `input`. To a model choosing between them, they're the same component listed three times.

What actually separates them is mechanism. One reads out a threshold by physically bending a bimetallic strip. One is a rotational confirm that only fires when you land within a few degrees. One is a sun going into eclipse. Those are three different products, and none of that fits in a tag.

So every component in the registry carries a written mechanism description. Not what it's called or what family it belongs to, but what it does and how, in enough detail that you could rebuild it from the text. It reads more like a spec than a doc.

### One fetch, no protocol

The second decision was distribution.

The obvious move in 2026 is an MCP server. I didn't build one, and I want to be careful about why, because MCP is genuinely good and I use it constantly.

An MCP server is a dependency. Something has to run, be configured, stay up, and be discovered. For a component registry, that's a lot of machinery in front of what is fundamentally a list of files.

So instead:

```
GET https://design.helpmarq.com/llms.txt
```

That's the whole catalog. Every component, its props, the situation it suits, and the exact command to install it. One request, plain text, no auth, no protocol, no server. Anything that can make an HTTP request can read it, pick a component, and install it in two steps.

There's a second file, `llms-full.txt`, that carries the full mechanism description per component. It exists for the case that broke my tag experiment: when several components share a role and a model has to tell them apart.

Installing is a shadcn command, which means the component lands in your project as source you own. No package, nothing to keep in sync, nothing to break when I change something. If you want to edit it, edit it. It's yours.

### The part I keep thinking about

Writing specs for machines made the library better for people.

Every component now has a paragraph explaining what it actually does, written to be precise rather than persuasive. When I audited the registry recently, several components failed against their own written spec. One had an animation that traveled 12 pixels instead of the 250 it described. One had a demo that claimed to be interactive and ignored every click. One shader was computing a band that mathematically cancelled itself to a 1.4 pixel sliver, which is why it looked like a focus ring instead of the molten chrome the spec promised.

I found those because the spec said one thing and the component did another. Without the spec there is nothing to be wrong against, and all three would still be shipping.

That's the argument, in the end. Writing documentation a machine can read forces a kind of precision that documentation for humans lets you skip. You can write "a beautiful animated button" for a person. You cannot write it for a model, and it turns out you shouldn't have written it for the person either.

Registry: [github.com/nikolas-sapa/ns-ui](https://github.com/nikolas-sapa/ns-ui) (MIT)
Live: [design.helpmarq.com](https://design.helpmarq.com)
Agent catalog: [design.helpmarq.com/llms.txt](https://design.helpmarq.com/llms.txt)
