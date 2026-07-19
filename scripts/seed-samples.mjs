import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const DIMS = 384;

function tokenize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hashToken(token) {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function embedLocal(text) {
  const vec = new Array(DIMS).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;
  for (const token of tokens) {
    const h = hashToken(token);
    const idx = h % DIMS;
    const sign = hashToken(`s:${token}`) % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

function chunkText(text, size = 900, overlap = 150) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  if (normalized.length <= size) return [normalized];
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);
    if (end < normalized.length) {
      const window = normalized.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("\n"),
      );
      if (breakAt > size * 0.4) end = start + breakAt + 1;
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function slugId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const samples = [
  {
    title: "Kebijakan Cuti Karyawan 2026",
    filename: "01-kebijakan-cuti.md",
    content: `# Kebijakan Cuti Karyawan 2026

## Ringkasan
Setiap karyawan penuh waktu berhak atas 12 hari cuti tahunan dan 3 hari cuti sakit berbayar tanpa surat dokter (maksimal 1 hari berurutan tanpa surat).

## Cuti Tahunan
- Hak cuti muncul setelah masa probation 3 bulan.
- Pengajuan minimal 5 hari kerja sebelumnya lewat portal HR.
- Maksimal 5 hari cuti berurutan tanpa persetujuan direktur.
- Sisa cuti boleh dibawa ke tahun berikutnya maksimal 5 hari, hangus pada 31 Maret.

## Cuti Sakit
- 1 hari: cukup notifikasi ke atasan sebelum jam 09.00.
- 2+ hari: wajib surat dokter.
- Rawat inap: cuti sakit tidak mengurangi jatah cuti tahunan.

## Cuti Khusus
- Pernikahan karyawan: 3 hari.
- Kelahiran anak: 2 hari (ayah) / mengikuti UU untuk ibu.
- Kedukaan keluarga inti: 3 hari.

## Kontak
HR Business Partner: hr@lumen.example — Slack #hr-help.
`,
  },
  {
    title: "Runbook On-Call Backend",
    filename: "02-runbook-oncall.md",
    content: `# Runbook On-Call Backend

## Severity
- Sev-1: layanan utama down atau data loss. Response < 15 menit.
- Sev-2: degradasi signifikan. Response < 30 menit.
- Sev-3: bug non-kritis. Response di jam kerja berikutnya.

## Checklist Insiden
1. Acknowledge alert di PagerDuty.
2. Buat channel Slack #inc-YYYYMMDD-shortname.
3. Cek dashboard Grafana: error rate, p95 latency, DB connections.
4. Jika error rate > 5% selama 3 menit, scale API replicas ke 2x.
5. Rollback deploy terakhir jika error muncul < 20 menit setelah release.

## Database
- Connection pool max = 40. Alarm jika waiting > 10.
- Failover read replica: update DATABASE_READ_URL di secrets, restart workers.
- Jangan pernah jalankan migration di peak hours (11.00–14.00 WIB).

## Komunikasi
- Update status page setiap 20 menit selama Sev-1.
- Setelah resolved: postmortem dalam 48 jam (blameless).

## Kontak Escalation
Primary: oncall-backend@lumen.example
Secondary: platform-lead@lumen.example
`,
  },
  {
    title: "Panduan Produk Lumen Desk",
    filename: "03-panduan-produk.md",
    content: `# Panduan Produk Lumen Desk

Lumen adalah knowledge desk berbasis RAG (Retrieval-Augmented Generation).

## Alur Kerja
1. Unggah dokumen (.txt / .md).
2. Sistem memotong teks menjadi chunk overlapping.
3. Setiap chunk di-embed menjadi vektor.
4. Saat user bertanya, query di-embed lalu dicari chunk paling mirip (cosine similarity).
5. Model menjawab hanya dari konteks yang ditemukan, dengan sitasi sumber.

## Prinsip Jawaban
- Jika konteks tidak cukup, model harus mengaku tidak tahu.
- Setiap klaim faktual sebaiknya menunjuk ke sumber.
- Jangan mengarang kebijakan internal yang tidak ada di dokumen.

## Metrik Sukses
- Precision@4 retrieval > 0.7 pada evaluasi manual.
- Latency end-to-end p95 < 4 detik.
- Embedding lokal dipakai untuk demo gratis; produksi sebaiknya pakai embedding model khusus.
`,
  },
  {
    title: "Kebijakan Remote Work",
    filename: "04-remote-work.md",
    content: `# Kebijakan Remote Work

## Aturan Umum
- Hybrid default: 3 hari kantor, 2 hari remote per minggu.
- Full remote hanya untuk role yang disetujui People Ops.
- Jam kerja inti (core hours): 10.00–15.00 WIB untuk meeting sinkron.

## Persyaratan Remote
- Koneksi internet stabil minimal 20 Mbps.
- Camera on untuk meeting dengan klien eksternal.
- Status Slack harus akurat (available / deep work / away).

## Expense
- Internet rumah: reimburse maks Rp 300.000 / bulan dengan bukti transfer.
- Kursi & monitor: sekali claim maks Rp 2.500.000 setelah lulus probation.
- Coworking: perlu approval manager sebelumnya.

## Security
- Wajib VPN perusahaan sebelum akses staging/production.
- Dilarang pakai Wi-Fi publik tanpa VPN.
- Laptop harus full-disk encryption aktif.
`,
  },
  {
    title: "SOP Expense & Reimbursement",
    filename: "05-sop-expense.md",
    content: `# SOP Expense & Reimbursement

## Batas Waktu
- Klaim diajukan maksimal 30 hari setelah tanggal transaksi.
- Approval manager dalam 3 hari kerja.
- Finance bayar setiap Rabu untuk klaim yang approved Senin.

## Kategori
- Transport dinas dalam kota: Grab/Gojek business profile.
- Makan klien: maks Rp 150.000 / orang, wajib cantumkan nama klien.
- Software tools: wajib lewat IT procurement, jangan bayar pribadi dulu.

## Bukti
- Wajib foto/PDF invoice + nomor PO jika ada.
- Tanpa bukti valid, klaim ditolak otomatis.
- Mata uang asing dikonversi pakai kurs mid BI tanggal transaksi.

## Kontak
Finance: finance@lumen.example — Slack #finance-help
`,
  },
  {
    title: "Security Awareness Handbook",
    filename: "06-security-awareness.md",
    content: `# Security Awareness Handbook

## Password & MFA
- Password minimal 12 karakter, unik per layanan.
- MFA wajib untuk email, GitHub, cloud console, dan VPN.
- Dilarang share password lewat Slack/email.

## Phishing
- Jangan klik tautan mendesak soal gaji/HR tanpa verifikasi channel resmi.
- Laporkan email mencurigakan ke security@lumen.example.
- Jangan pernah kirim OTP ke siapa pun.

## Data Sensitif
- Data pelanggan hanya di tools resmi (CRM / warehouse).
- Jangan export data ke USB pribadi.
- Saat share layar, tutup tab berisi credentials.

## Insiden
- Dugaan kebocoran akun: ganti password segera, hubungi IT dalam 15 menit.
- Device hilang: remote wipe via MDM + lapor Security.
`,
  },
  {
    title: "Engineering Coding Standards",
    filename: "07-coding-standards.md",
    content: `# Engineering Coding Standards

## Bahasa & Stack
- TypeScript strict mode wajib untuk service baru.
- API memakai REST + OpenAPI; event internal pakai JSON schema.
- Jangan merge PR tanpa CI hijau.

## Review
- Minimal 1 approval dari engineer lain.
- PR > 400 baris sebaiknya dipecah.
- Deskripsikan "why", bukan hanya "what".

## Testing
- Unit test untuk logika bisnis kritis.
- Integration test untuk endpoint autentikasi & pembayaran.
- Coverage target minimal 70% untuk modul core.

## Logging
- Jangan log PII (NIK, nomor kartu, password).
- Pakai structured JSON logs.
- Correlation ID wajib di setiap request.
`,
  },
  {
    title: "Customer Support Playbook",
    filename: "08-support-playbook.md",
    content: `# Customer Support Playbook

## SLA
- Priority P1 (produk down): first response < 15 menit.
- Priority P2 (fitur rusak): first response < 2 jam.
- Priority P3 (pertanyaan umum): first response < 1 hari kerja.

## Escalation
- Billing dispute → Finance.
- Bug reproduksibel → Engineering lewat Linear label \`customer-bug\`.
- Ancaman hukum → Legal + Leadership.

## Nada Komunikasi
- Empati dulu, solusi kedua.
- Jangan janji timeline yang belum dikonfirmasi eng.
- Tutup tiket hanya setelah customer konfirmasi atau 48 jam tanpa balasan.

## Makro Singkat
- Reset password: arahkan ke /account/security, jangan minta password user.
- Refund: cek SOP Expense & kebijakan refund produk sebelum commit.
`,
  },
  {
    title: "FAQ Produk Billing",
    filename: "09-faq-billing.md",
    content: `# FAQ Produk Billing

## Paket
- Free: 1 workspace, 100 query AI / bulan.
- Pro: Rp 249.000 / bulan, 5 seats, 5.000 query.
- Business: custom, SSO + audit log.

## Pembayaran
- Kartu kredit / debit & transfer virtual account.
- Invoice Business terbit tanggal 1 setiap bulan.
- Gagal bayar: grace period 7 hari, lalu workspace read-only.

## Refund
- Langganan bulanan: refund penuh jika cancel dalam 7 hari pertama.
- Langganan tahunan: refund proporsional dikurangi 1 bulan yang terpakai.
- Add-on yang sudah dipakai tidak bisa direfund.

## Pajak
- Harga sudah termasuk PPN 11% untuk pelanggan Indonesia.
- Pelanggan luar negeri: harga tanpa PPN, wajib isi tax ID jika ada.
`,
  },
  {
    title: "Office & Facilities Guide",
    filename: "10-office-facilities.md",
    content: `# Office & Facilities Guide

## Alamat & Akses
- Kantor: Lumen Tower Lantai 12, Jakarta Selatan.
- Akses gate pakai kartu karyawan; visitor wajib daftar di resepsionis.
- Jam operasional lobby: 07.00–21.00 WIB.

## Meeting Room
- Booking lewat Google Calendar resource.
- Ruang fokus (phone booth): maks 30 menit per sesi.
- Bersihkan whiteboard setelah selesai.

## Fasilitas
- Pantry: kopi/teh gratis; makan siang berbayar via QR.
- Loker: minta kunci ke Office Manager.
- Parking: 20 slot kendaraan, first-come first-served.

## Emergency
- Titik kumpul gempa: sisi barat gedung dekat taman.
- APAR di setiap lantai dekat lift.
- Kontak darurat Office Manager: facilities@lumen.example
`,
  },
];

const documents = [];
const chunks = [];

for (const sample of samples) {
  const pieces = chunkText(sample.content);
  const documentId = slugId("doc");
  const meta = {
    id: documentId,
    title: sample.title,
    filename: sample.filename,
    chars: sample.content.trim().length,
    chunks: pieces.length,
    createdAt: new Date().toISOString(),
  };
  documents.unshift(meta);
  pieces.forEach((text, index) => {
    chunks.push({
      id: `${documentId}_c${index}`,
      documentId,
      title: meta.title,
      filename: meta.filename,
      index,
      text,
      embedding: embedLocal(text),
    });
  });
}

const storePath = path.join(root, "data", "store.json");
const seedPath = path.join(root, "data", "seed-store.json");
const payload = JSON.stringify({ documents, chunks }, null, 2);
await fs.mkdir(path.dirname(storePath), { recursive: true });
await fs.writeFile(storePath, payload, "utf8");
await fs.writeFile(seedPath, payload, "utf8");

console.log(`Indexed ${documents.length} docs, ${chunks.length} chunks`);
console.log(`-> ${storePath}`);
console.log(`-> ${seedPath}`);
