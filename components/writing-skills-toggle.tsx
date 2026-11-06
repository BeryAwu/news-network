"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/skills?mediaSiteId=${encodeURIComponent(mediaSiteId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setSkills(data.skills ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat daftar skill.");
      });
    return () => { cancelled = true; };
  }, [mediaSiteId]);

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
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Perubahan skill gagal disimpan.");
      setSkills((current) => current?.map((item) => item.id === skill.id ? { ...item, enabled } : item) ?? current);
      setMessage(enabled ? `Skill "${skill.name}" diaktifkan untuk media ini.` : `Skill "${skill.name}" dimatikan.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan skill gagal disimpan.");
    } finally {
      setBusyId(null);
    }
  }

  if (skills === null) {
    return (
      <details className="writing-skills" style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 650 }}>Skill penulisan AI</summary>
        <p className="muted" style={{ marginTop: 12 }}>Memuat…</p>
      </details>
    );
  }

  return (
    <details className="writing-skills" style={{ marginTop: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 650 }}>Skill penulisan AI</summary>
      {skills.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>Belum ada skill tersedia.</p>
      ) : (
        <div className="stack" style={{ marginTop: 12, gap: 10 }}>
          {skills.map((skill) => (
            <label key={skill.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={skill.enabled}
                disabled={busyId === skill.id}
                onChange={() => toggle(skill)}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>{skill.name}</strong>
                <span className="muted" style={{ display: "block", fontSize: 13 }}>{skill.description}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {error && <div role="alert" className="notice notice-error" style={{ marginTop: 10, marginBottom: 0 }}>{error}</div>}
      {message && <div role="status" className="notice" style={{ marginTop: 10, marginBottom: 0 }}>{message}</div>}
    </details>
  );
}
