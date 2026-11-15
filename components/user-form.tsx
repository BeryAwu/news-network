"use client";

import "@/app/css/team.css";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { assignableRoles, ownerMeaning, roleNames } from "@/components/team-roles";
import { asFailure, failure, readBody } from "@/components/plain-errors";

const MIN_PASSWORD = 14;
const apiFields = {
  name: "Nama terlalu pendek. Tulis nama lengkap, minimal 2 huruf.",
  email: "Alamat email belum benar. Contoh yang benar: nama@media.id.",
  password: `Kata sandi terlalu pendek. Pakai minimal ${MIN_PASSWORD} karakter.`,
  mediaSiteIds: "Pilihan media belum benar. Muat ulang halaman, lalu pilih lagi.",
};
type Errors = Partial<Record<"name" | "email" | "password" | "access", string>>;

export default function UserForm({ media }: { media: { id: string; displayName: string }[] }) {
  const router = useRouter();
  const uid = useId();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("OPERATOR");
  const [picked, setPicked] = useState<string[]>(() => media.map((item) => item.id));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isAdmin = role === "ADMIN";
  const left = Math.max(MIN_PASSWORD - password.length, 0);

  function focusField(id: string) {
    document.getElementById(`${uid}-${id}`)?.focus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setMessage("");
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const chosen = picked.filter((id) => media.some((item) => item.id === id));
    const errors: Errors = {};
    if (name.length < 2) errors.name = apiFields.name;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = apiFields.email;
    if (password.length < MIN_PASSWORD) errors.password = `${apiFields.password} Kurang ${left} karakter.`;
    if (!isAdmin && !media.length) errors.access = "Belum ada media yang bisa dipilih. Tambahkan media dulu di halaman Media saya.";
    else if (!isAdmin && !chosen.length) errors.access = "Pilih minimal satu media. Tanpa media, pengguna ini belum bisa menulis berita.";
    setFieldErrors(errors);
    const first = (["name", "email", "password", "access"] as const).find((key) => errors[key]);
    if (first) {
      focusField(first === "access" ? "access" : first);
      return;
    }
    setBusy(true);
    try {
      const mediaSiteIds = isAdmin ? [] : chosen;
      const response = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password, role, mediaSiteIds }) });
      const result = await readBody(response);
      if (!response.ok) throw failure(response.status, result, apiFields, "Akun belum dibuat. Periksa isian di atas, lalu coba lagi.");
      setMessage(`Akun ${String(result.email)} sudah dibuat sebagai ${roleNames[String(result.role)] || String(result.role)}. Kirim email dan kata sandi sementara lewat pesan pribadi. Orang ini bisa masuk dari halaman login, dan namanya muncul di daftar di bawah.`);
      setPassword("");
      form.reset();
      setRole("OPERATOR");
      setPicked(media.map((item) => item.id));
      router.refresh();
    } catch (e) {
      const problem = asFailure(e, "Akun belum dibuat. Periksa isian di atas, lalu coba lagi.");
      if (problem.field === "name" || problem.field === "email" || problem.field === "password") {
        setFieldErrors({ [problem.field]: problem.message });
        focusField(problem.field);
      } else {
        setError(problem.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} noValidate className="card stack team-form" aria-labelledby={`${uid}-title`}>
    <div className="form-intro">
      <h2 id={`${uid}-title`}>Tambahkan anggota tim</h2>
      <p>Orang yang Anda tambahkan bisa langsung masuk dengan email dan kata sandi sementara. Semua kolom wajib diisi.</p>
    </div>
    <div className="grid grid-2">
      <div className="field">
        <label htmlFor={`${uid}-name`}>Nama</label>
        <input id={`${uid}-name`} name="name" maxLength={120} autoComplete="off" aria-required="true" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? `${uid}-name-error` : undefined}/>
        {fieldErrors.name && <p id={`${uid}-name-error`} className="field-error">{fieldErrors.name}</p>}
      </div>
      <div className="field">
        <label htmlFor={`${uid}-email`}>Alamat email</label>
        <input id={`${uid}-email`} name="email" type="email" inputMode="email" maxLength={254} autoComplete="off" aria-required="true" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? `${uid}-email-error` : `${uid}-email-help`}/>
        {fieldErrors.email ? <p id={`${uid}-email-error`} className="field-error">{fieldErrors.email}</p> : <p id={`${uid}-email-help`} className="field-help">Dipakai untuk masuk.</p>}
      </div>
    </div>
    <div className="field team-password">
      <label htmlFor={`${uid}-password`}>Kata sandi sementara</label>
      <div className="password-wrap">
        <input id={`${uid}-password`} name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={200} autoComplete="new-password" aria-required="true" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={`${uid}-password-help`}/>
        <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}</button>
      </div>
      <p id={`${uid}-password-help`} className={fieldErrors.password ? "field-error" : "field-help"}>
        {fieldErrors.password || `Minimal ${MIN_PASSWORD} karakter. Empat kata acak yang mudah diingat sudah cukup panjang. ${left > 0 ? `Kurang ${left} karakter.` : "Panjangnya sudah cukup."}`}
      </p>
    </div>

    <fieldset className="team-fieldset">
      <legend>Peran</legend>
      <p className="field-help">Peran menentukan apa yang boleh dikerjakan orang ini. Pilih satu.</p>
      <div className="choice-list">
        {assignableRoles.map((item) => <label className="choice" key={item.value}>
          <input type="radio" name="role" value={item.value} checked={role === item.value} onChange={() => setRole(item.value)}/>
          <span className="choice-copy"><strong>{item.name}</strong><small>{item.meaning}</small></span>
        </label>)}
      </div>
      <p className="field-help">{ownerMeaning}</p>
    </fieldset>

    {isAdmin
      ? <div className="notice">Admin otomatis boleh memakai semua media, termasuk media yang ditambahkan nanti.</div>
      : <fieldset className="team-fieldset" aria-describedby={fieldErrors.access ? `${uid}-access-error` : `${uid}-access-help`}>
        <legend>Media yang boleh dipakai</legend>
        <p id={`${uid}-access-help`} className="field-help">Orang ini hanya bisa menulis berita ke media yang tercentang. Pengguna tidak bisa mengubah daftar ini sendiri. Hanya pemilik.</p>
        {media.length
          ? <>
            <div className="team-media-list">{media.map((item, index) => <label className="checkline" key={item.id}>
              <input id={index === 0 ? `${uid}-access` : undefined} type="checkbox" checked={picked.includes(item.id)} onChange={() => setPicked((list) => list.includes(item.id) ? list.filter((id) => id !== item.id) : [...list, item.id])}/>
              <span>{item.displayName}</span>
            </label>)}</div>
            <p className="field-help num">{picked.length} dari {media.length} media dipilih</p>
          </>
          : <div className="notice notice-warn">Belum ada media. Tambahkan media di halaman Media saya sebelum menambah anggota.</div>}
        {fieldErrors.access && <p id={`${uid}-access-error`} className="field-error">{fieldErrors.access}</p>}
      </fieldset>}

    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {message && <div role="status" className="notice notice-success">{message}</div>}
    <div className="actions"><button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Membuat akun…" : "Buat akun anggota"}</button></div>
  </form>;
}
