"use client";

import "@/app/css/media.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui";
import Switch from "@/components/switch";
import { asFailure, failure, readBody } from "@/components/plain-errors";

interface SkillOption {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
}

export default function WritingSkillsToggle({ mediaSiteId }: { mediaSiteId: string }) {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillOption[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/skills?mediaSiteId=${encodeURIComponent(mediaSiteId)}`)
      .then(async (response) => {
        const body = await readBody(response);
        if (!response.ok) throw failure(response.status, body, {}, "Daftar gaya penulisan belum bisa dimuat. Coba lagi sebentar lagi.");
        return body as { skills?: SkillOption[] };
      })
      .then((data) => {
        if (!cancelled) setSkills(data.skills ?? []);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(asFailure(e, "Daftar gaya penulisan belum bisa dimuat. Coba lagi sebentar lagi.").message);
      });
    return () => { cancelled = true; };
  }, [mediaSiteId, attempt]);

  async function toggle(skill: SkillOption) {
    const enabled = !skill.enabled;
    setBusyId(skill.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/skills", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaSiteId, skillId: skill.id, enabled }),
      });
      const result = await readBody(response);
      if (!response.ok) throw failure(response.status, result, {}, "Perubahan belum tersimpan. Coba lagi sebentar lagi.");
      setSkills((current) => current?.map((item) => item.id === skill.id ? { ...item, enabled } : item) ?? current);
      setMessage(enabled ? `Gaya ${skill.name} menyala. Draf AI berikutnya untuk media ini memakainya.` : `Gaya ${skill.name} dimatikan. Draf yang sudah ada tidak berubah.`);
      router.refresh();
    } catch (e) {
      setError(asFailure(e, "Perubahan belum tersimpan. Coba lagi sebentar lagi.").message);
    } finally {
      setBusyId(null);
    }
  }

  function retry() {
    setLoadError("");
    setSkills(null);
    setAttempt((value) => value + 1);
  }

  return <section className="stack skills" aria-labelledby={`skills-${mediaSiteId}`}>
    <div className="form-intro">
      <h3 id={`skills-${mediaSiteId}`}>Gaya penulisan</h3>
      <p>Pilih gaya yang dipakai AI saat membuat draf untuk media ini. Gaya yang menyala ikut diterapkan ke setiap draf baru.</p>
    </div>

    {loadError
      ? <div role="alert" className="notice notice-error"><div className="stack-sm"><span>{loadError}</span><div className="actions"><button type="button" className="btn" onClick={retry}>Coba lagi</button></div></div></div>
      : skills === null
        ? <div className="skill-skeleton" role="status" aria-label="Memuat gaya penulisan"><div className="skeleton"/><div className="skeleton"/></div>
        : skills.length === 0
          ? <EmptyState title="Belum ada gaya penulisan" detail="Belum ada gaya penulisan di sistem. Setelah ada, Anda bisa menyalakannya di sini untuk tiap media." />
          : <ul className="skill-list">
            {skills.map((skill) => <li className="skill-row" key={skill.id}>
              <div className="skill-copy">
                <strong>{skill.name}</strong>
                <p id={`skill-${skill.id}-description`} className="muted">{skill.description}</p>
              </div>
              <Switch checked={skill.enabled} onChange={() => toggle(skill)} disabled={busyId === skill.id} label={busyId === skill.id ? "Menyimpan…" : skill.enabled ? "Menyala" : "Mati"} ariaLabel={`Gaya ${skill.name}: ${skill.enabled ? "menyala" : "mati"}`} describedBy={`skill-${skill.id}-description`} />
            </li>)}
          </ul>}

    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {message && <div role="status" className="notice notice-success">{message}</div>}
  </section>;
}
