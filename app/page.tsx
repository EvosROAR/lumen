import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="orb absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.28),transparent_68%)]" />
        <div className="orb-slow absolute -right-16 top-32 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(59,100,160,0.22),transparent_70%)]" />
        <div className="scan-line absolute inset-x-0 top-[42%] h-px bg-gradient-to-r from-transparent via-teal-700/40 to-transparent" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[0.18em] text-ink">
          LUMEN
        </p>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-ink-soft transition hover:text-teal"
          >
            Masuk
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-mist transition hover:bg-teal"
          >
            Mulai
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-20 pt-8">
        <p className="animate-rise font-[family-name:var(--font-display)] text-6xl font-semibold tracking-[0.2em] text-ink sm:text-8xl md:text-9xl">
          LUMEN
        </p>
        <h1 className="animate-rise-delay mt-6 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-medium leading-tight text-ink sm:text-4xl md:text-5xl">
          Tanya dokumenmu. Dapat jawaban yang bisa dilacak.
        </h1>
        <p className="animate-rise-delay-2 mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
          Knowledge desk berbasis RAG: unggah PDF atau teks, chat dengan sitasi,
          bandingkan Vector/BM25/Hybrid, dan ukur retrieval untuk riset atau skripsi.
        </p>
        <div className="animate-rise-delay-2 mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-mist transition hover:bg-teal"
          >
            Masuk / Daftar
          </Link>
          <a
            href="#fitur"
            className="rounded-full border border-ink/15 bg-white/40 px-6 py-3 text-sm font-semibold text-ink-soft backdrop-blur transition hover:border-teal/40 hover:text-teal"
          >
            Lihat kemampuan
          </a>
        </div>
      </section>

      <section
        id="fitur"
        className="relative z-10 border-t border-ink/10 bg-white/35 backdrop-blur-sm"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
          <Feature
            title="Hybrid retrieval"
            body="Embedding + BM25 digabung supaya makna dan keyword eksak sama-sama tertangkap."
          />
          <Feature
            title="Jawaban + sitasi"
            body="Streaming answer dengan sumber terambil — klaim bisa diverifikasi dari cuplikan dokumen."
          />
          <Feature
            title="Eval & eksperimen"
            body="Golden set per akun, bandingkan 3 mode retrieval, plus log latency untuk analisis."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="group">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink transition group-hover:text-teal">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p>
      <div className="mt-4 h-px w-10 bg-teal/40 transition-all duration-300 group-hover:w-16" />
    </div>
  );
}
