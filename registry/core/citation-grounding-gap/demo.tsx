"use client";

import { TrestleGap, type TrestleSentence } from "./component";

// A short RAG answer mixing grounded and ungrounded claims. The first
// sentence is deliberately grounded — it's the first interactive control in
// DOM order, so the autoplay "press" driver and the verifier's gate both
// land on the same element, and it opens straight back up after an
// Escape-close in between (a real re-open, not a stale toggle). The second
// sentence has no source at all: its plank draws as an open gap so the
// coverage story reads at rest, before anyone clicks anything.
const SENTENCES: TrestleSentence[] = [
  {
    id: "s1",
    text: "Retrieval-augmented generation grounds a model's answer in passages fetched from an external index at query time.",
    source: {
      title: "RAG: Retrieval-Augmented Generation for Knowledge-Intensive NLP",
      excerpt:
        "We introduce RAG models which combine pre-trained parametric memory with a non-parametric memory accessed through retrieval, grounding generation in retrieved passages fetched at query time.",
      url: "https://arxiv.org/abs/2005.11401",
    },
  },
  {
    id: "s2",
    text: "This alone cuts hallucination rates by roughly half compared to a model answering from parametric memory only.",
    source: null,
  },
  {
    id: "s3",
    text: "The retrieved passages are typically ranked by a dense encoder trained jointly with the generator.",
    source: {
      title: "Dense Passage Retrieval for Open-Domain Question Answering",
      excerpt:
        "Our dense encoder is trained end-to-end with the reader, producing passage rankings that substantially outperform traditional sparse retrieval on open-domain QA benchmarks.",
      url: "https://arxiv.org/abs/2004.04906",
    },
  },
  {
    id: "s4",
    text: "Most production pipelines refresh the index nightly rather than serving it fully live.",
    source: null,
  },
  {
    id: "s5",
    text: "Chunk sizes between 200 and 500 tokens tend to balance recall against context dilution.",
    source: {
      title: "Internal eval notes — chunking sweep",
      excerpt:
        "Across our chunking sweep, spans in the 200-500 token range gave the best recall-to-dilution tradeoff before longer chunks began diluting the retriever's attention.",
    },
  },
];

export default function TrestleGapDemo() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-8 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / trestle-gap — coverage you can see, not one you have to hover for
      </p>
      <div className="rounded-md border border-border bg-background p-6">
        <TrestleGap sentences={SENTENCES} />
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Click a solid plank to open its source. Click a gap — or focus it and press{" "}
        <kbd className="rounded-[3px] border border-border px-1 font-mono">f</kbd> — to search for support.
      </p>
    </div>
  );
}
