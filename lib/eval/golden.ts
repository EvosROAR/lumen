export type GoldenCase = {
  id: string;
  question: string;
  /** Expected source filenames (any match in top-K counts as hit). */
  expectedFilenames: string[];
  expectedAnswerHint: string;
};

/** Golden set for retrieval evaluation — interview-ready AI Developer artifact. */
export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "cuti-tahunan",
    question: "Berapa hari cuti tahunan karyawan?",
    expectedFilenames: ["01-kebijakan-cuti.md"],
    expectedAnswerHint: "12 hari",
  },
  {
    id: "cuti-sakit",
    question: "Kapan wajib surat dokter untuk cuti sakit?",
    expectedFilenames: ["01-kebijakan-cuti.md"],
    expectedAnswerHint: "2+ hari",
  },
  {
    id: "sev1",
    question: "Berapa lama response time untuk Sev-1?",
    expectedFilenames: ["02-runbook-oncall.md"],
    expectedAnswerHint: "15 menit",
  },
  {
    id: "migration",
    question: "Kapan tidak boleh jalankan migration database?",
    expectedFilenames: ["02-runbook-oncall.md"],
    expectedAnswerHint: "peak hours 11.00–14.00",
  },
  {
    id: "rag-alur",
    question: "Bagaimana alur kerja RAG di Lumen Desk?",
    expectedFilenames: ["03-panduan-produk.md"],
    expectedAnswerHint: "chunk embed retrieve generate",
  },
  {
    id: "remote-hybrid",
    question: "Berapa hari kantor vs remote dalam kebijakan hybrid?",
    expectedFilenames: ["04-remote-work.md"],
    expectedAnswerHint: "3 kantor 2 remote",
  },
  {
    id: "vpn",
    question: "Apakah wajib VPN saat remote akses staging?",
    expectedFilenames: ["04-remote-work.md"],
    expectedAnswerHint: "wajib VPN",
  },
  {
    id: "expense-deadline",
    question: "Berapa hari maksimal mengajukan klaim expense?",
    expectedFilenames: ["05-sop-expense.md"],
    expectedAnswerHint: "30 hari",
  },
  {
    id: "mfa",
    question: "Untuk layanan apa saja MFA wajib?",
    expectedFilenames: ["06-security-awareness.md"],
    expectedAnswerHint: "email GitHub cloud VPN",
  },
  {
    id: "pr-review",
    question: "Berapa approval minimal untuk merge PR?",
    expectedFilenames: ["07-coding-standards.md"],
    expectedAnswerHint: "1 approval",
  },
  {
    id: "sla-p1",
    question: "Berapa SLA first response Priority P1 support?",
    expectedFilenames: ["08-support-playbook.md"],
    expectedAnswerHint: "15 menit",
  },
  {
    id: "billing-pro",
    question: "Berapa harga paket Pro per bulan?",
    expectedFilenames: ["09-faq-billing.md"],
    expectedAnswerHint: "249.000",
  },
  {
    id: "refund",
    question: "Bagaimana kebijakan refund langganan bulanan?",
    expectedFilenames: ["09-faq-billing.md"],
    expectedAnswerHint: "7 hari pertama",
  },
  {
    id: "office",
    question: "Di lantai berapa kantor Lumen Tower?",
    expectedFilenames: ["10-office-facilities.md"],
    expectedAnswerHint: "lantai 12",
  },
  {
    id: "phone-booth",
    question: "Berapa lama maksimal pakai phone booth?",
    expectedFilenames: ["10-office-facilities.md"],
    expectedAnswerHint: "30 menit",
  },
];
