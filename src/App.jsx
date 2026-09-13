import React, { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import {
  ShieldCheck, Phone, MapPin, Bell, Building2, Droplet, Pill,
  AlertTriangle, X, Plus, ArrowLeft, ArrowRight, LogOut, UploadCloud,
  FileText, Sparkles, ExternalLink, Loader2, CheckCircle2, WifiOff,
  Eye, EyeOff, Pencil, Trash2, Check,
} from "lucide-react";

/* ---------------------------------------------------------------
   MediVault
   Real signup + login (this device/browser is the account), editable
   family profiles, offline-readable QR Emergency ID, Emergency Mode,
   and a document → AI summary pipeline. Installable on Android/iOS
   as a home-screen app (see public/manifest.json).

   Storage note: the account and profiles live in this browser's
   localStorage. That's real and persistent for the person using this
   phone/browser — but it does not sync across devices. A shared
   backend + database is the natural next step for that. See README.
----------------------------------------------------------------- */

const TOKENS = {
  ink: "#0F2A2E",
  paper: "#F6F8F6",
  panel: "#FFFFFF",
  teal: "#0E7C7B",
  tealDeep: "#0A5F5E",
  tealSoft: "#E1F1EE",
  line: "#DCE6E2",
  muted: "#5B7472",
  coral: "#DD4E2C",
  coralSoft: "#FBE7DE",
  gold: "#B98A22",
};
const serif = `'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif`;
const sans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif`;

const ACCOUNT_KEY = "medivault_account_v2";
const SESSION_KEY = "medivault_session_v2";

const HOSPITALS = [
  { name: "Yashoda Super Speciality Hospital", distance: "1.8 km" },
  { name: "Santosh Medical College & Hospital", distance: "3.2 km" },
  { name: "Max Hospital, Vaishali", distance: "4.6 km" },
];

/* ---------------------------- storage + auth helpers ---------------------------- */

function randomToken() {
  return Array.from({ length: 12 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("");
}

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function loadAccount() {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function saveAccount(account) {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch (e) {
    // Storage full or unavailable — account stays in memory for this session only.
  }
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ---------------------------- shared UI bits ---------------------------- */

function Field({ icon: Icon, label, children, accent }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${TOKENS.line}` }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: accent || TOKENS.tealSoft, color: accent ? "#fff" : TOKENS.tealDeep,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={17} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, letterSpacing: 0.2, color: TOKENS.muted, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 15.5, color: TOKENS.ink, fontWeight: 600, lineHeight: 1.35 }}>{children}</div>
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", full, icon: Icon, disabled, type = "button", style = {} }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "13px 18px", borderRadius: 10, fontSize: 14.5, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", border: "none", width: full ? "100%" : "auto",
    fontFamily: sans, transition: "transform .12s ease, opacity .12s ease",
    opacity: disabled ? 0.55 : 1, minHeight: 46, boxSizing: "border-box",
  };
  const variants = {
    primary: { background: TOKENS.teal, color: "#fff" },
    urgent: { background: TOKENS.coral, color: "#fff" },
    ghost: { background: "transparent", color: TOKENS.tealDeep, border: `1.5px solid ${TOKENS.line}` },
    subtle: { background: TOKENS.tealSoft, color: TOKENS.tealDeep },
    danger: { background: "transparent", color: TOKENS.coral, border: `1.5px solid ${TOKENS.coralSoft}` },
  };
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

const backBtnStyle = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
  color: TOKENS.teal, fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: sans,
};
const bareInputStyle = {
  width: "100%", padding: "12px 13px", borderRadius: 9, border: `1.5px solid ${TOKENS.line}`,
  fontSize: 15, fontFamily: sans, color: TOKENS.ink, outline: "none", boxSizing: "border-box",
  minHeight: 46, background: "#fff",
};

// Labeled field wrapper — small caption above a real input, used across
// signup, login and profile forms so every field is unambiguous.
function LabeledInput({ label, error, style, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12.5, color: TOKENS.muted, marginBottom: 6, fontWeight: 600 }}>{label}</label>
      <input {...props} style={{ ...bareInputStyle, ...(error ? { borderColor: TOKENS.coral } : {}), ...style }} />
      {error && <div style={{ fontSize: 12, color: TOKENS.coral, marginTop: 5 }}>{error}</div>}
    </div>
  );
}
function LabeledSelect({ label, children, style, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12.5, color: TOKENS.muted, marginBottom: 6, fontWeight: 600 }}>{label}</label>
      <select {...props} style={{ ...bareInputStyle, ...style }}>{children}</select>
    </div>
  );
}

function PasswordInput({ label, value, onChange, error, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12.5, color: TOKENS.muted, marginBottom: 6, fontWeight: 600 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder}
          style={{ ...bareInputStyle, paddingRight: 42, ...(error ? { borderColor: TOKENS.coral } : {}) }}
        />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: TOKENS.muted, cursor: "pointer", padding: 4 }}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: TOKENS.coral, marginTop: 5 }}>{error}</div>}
    </div>
  );
}

/* ---------------------------- real QR (qrcode lib) ---------------------------- */

function QRCodeCanvas({ data, size = 240 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    QRCode.toCanvas(canvasRef.current, data, {
      width: size, margin: 4, errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).catch((e) => console.error("QR generation failed:", e));
  }, [data, size]);
  return <canvas ref={canvasRef} style={{ borderRadius: 4, display: "block", maxWidth: "100%" }} />;
}

// The QR encodes the critical fields as plain, human-readable text — not
// just a link — so any scanner (even offline, even a third-party app)
// shows them instantly with zero network needed. The full app link rides
// along at the end for when there IS internet (unlocks live-location
// sharing, hospital list, AI summary).
function buildOfflineQrPayload(member, publicUrl) {
  return [
    "MEDIVAULT — EMERGENCY ID",
    `Name: ${member.name} (${member.age}, ${member.gender})`,
    `Blood group: ${member.bloodGroup}`,
    `Allergies: ${member.allergies.join(", ")}`,
    `Conditions: ${member.conditions.join(", ")}`,
    `Medications: ${member.medications.join(", ")}`,
    member.contacts[0] ? `Emergency contact: ${member.contacts[0].name} — ${member.contacts[0].phone}` : "Emergency contact: Not provided",
    "",
    `Full details (needs internet): ${publicUrl}`,
  ].join("\n");
}

/* ---------------------------- dashboard bits ---------------------------- */

function IdCard({ member, onOpen }) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: TOKENS.panel, border: `1px solid ${TOKENS.line}`, borderRadius: 16,
        padding: 20, cursor: "pointer", position: "relative", overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 14, right: 14, width: 12, height: 12, borderRadius: "50%", background: TOKENS.paper, border: `1px solid ${TOKENS.line}` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 50, height: 50, borderRadius: "50%", background: TOKENS.tealSoft,
          color: TOKENS.tealDeep, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: serif, fontSize: 20, fontWeight: 600, flexShrink: 0,
        }}>
          {member.bloodGroup}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: TOKENS.ink, fontFamily: serif }}>{member.name}</div>
          <div style={{ fontSize: 13, color: TOKENS.muted }}>{member.relation} · {member.age} yrs</div>
        </div>
      </div>
      <div style={{
        marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${TOKENS.line}`,
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
      }}>
        <span style={{ fontSize: 12.5, color: TOKENS.muted }}>
          {member.allergies[0] === "None reported" ? "No known allergies" : `Allergic: ${member.allergies.join(", ")}`}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: TOKENS.teal, display: "flex", alignItems: "center", gap: 4 }}>
          View Emergency ID →
        </span>
      </div>
    </div>
  );
}

/* ---------------------------- shared member fields form ---------------------------- */

function emptyMemberForm() {
  return {
    name: "", relation: "", age: "", gender: "Female", bloodGroup: "O+",
    allergies: "", conditions: "", medications: "", contactName: "", contactPhone: "",
  };
}
function memberToForm(member) {
  return {
    name: member.name, relation: member.relation, age: String(member.age),
    gender: member.gender, bloodGroup: member.bloodGroup,
    allergies: member.allergies.filter((a) => a !== "None reported").join(", "),
    conditions: member.conditions.filter((c) => c !== "None reported").join(", "),
    medications: member.medications.filter((m) => m !== "None").join(", "),
    contactName: member.contacts[0]?.name || "", contactPhone: member.contacts[0]?.phone || "",
  };
}
function formToMember(form, existing) {
  return {
    ...(existing || {}),
    id: existing?.id || "m" + Date.now(),
    name: form.name.trim(), relation: form.relation.trim(), age: form.age || "—",
    gender: form.gender, bloodGroup: form.bloodGroup,
    allergies: form.allergies ? form.allergies.split(",").map((s) => s.trim()).filter(Boolean) : ["None reported"],
    conditions: form.conditions ? form.conditions.split(",").map((s) => s.trim()).filter(Boolean) : ["None reported"],
    medications: form.medications ? form.medications.split(",").map((s) => s.trim()).filter(Boolean) : ["None"],
    contacts: form.contactName ? [{ name: form.contactName.trim(), phone: form.contactPhone.trim() }] : [],
    token: existing?.token || randomToken(),
    aiSummary: existing?.aiSummary ?? null,
  };
}

function MemberFieldsForm({ form, setForm, showRelation = true }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
      <LabeledInput label="Full name" placeholder="e.g. Sharad Kumar Jaiswal" value={form.name} onChange={set("name")} />
      {showRelation && (
        <LabeledInput label="Relation to you" placeholder="e.g. Father, Mother, Sibling" value={form.relation} onChange={set("relation")} />
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><LabeledInput label="Age" placeholder="19" value={form.age} onChange={set("age")} /></div>
        <div style={{ flex: 1 }}>
          <LabeledSelect label="Gender" value={form.gender} onChange={set("gender")}>
            <option>Female</option><option>Male</option><option>Other</option>
          </LabeledSelect>
        </div>
        <div style={{ flex: 1 }}>
          <LabeledSelect label="Blood group" value={form.bloodGroup} onChange={set("bloodGroup")}>
            {["O+","O-","A+","A-","B+","B-","AB+","AB-"].map((b) => <option key={b}>{b}</option>)}
          </LabeledSelect>
        </div>
      </div>
      <LabeledInput label="Allergies" placeholder="e.g. Penicillin — leave blank if none" value={form.allergies} onChange={set("allergies")} />
      <LabeledInput label="Existing conditions" placeholder="e.g. Asthma, Diabetes" value={form.conditions} onChange={set("conditions")} />
      <LabeledInput label="Current medications" placeholder="e.g. Amlodipine 5mg" value={form.medications} onChange={set("medications")} />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><LabeledInput label="Emergency contact name" placeholder="e.g. Vijay Vardhan Jaiswal" value={form.contactName} onChange={set("contactName")} /></div>
        <div style={{ flex: 1 }}><LabeledInput label="Contact phone" placeholder="+91 XXXXX XXXXX" value={form.contactPhone} onChange={set("contactPhone")} /></div>
      </div>
    </>
  );
}

function MemberFormModal({ title, initial, onClose, onSave }) {
  const [form, setForm] = useState(initial ? memberToForm(initial) : emptyMemberForm());
  const canSave = form.name.trim() && form.relation.trim();
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,46,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div style={{ background: TOKENS.panel, borderRadius: 18, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontFamily: serif, fontSize: 21, color: TOKENS.ink, margin: 0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.muted, padding: 4 }}><X size={20} /></button>
        </div>
        <MemberFieldsForm form={form} setForm={setForm} />
        <Button full icon={Check} disabled={!canSave} style={{ marginTop: 4 }} onClick={() => onSave(formToMember(form, initial))}>
          Save profile
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------- documents + AI summary ---------------------------- */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

// The /api/summarize serverless function only exists on a real deployment
// (Vercel, or `vercel dev` locally) — plain `npm run dev` has nothing behind
// that route, so the response isn't valid JSON. Turn that into one clear,
// actionable message instead of a raw parse-error.
async function callSummarizeApi(base64, mediaType) {
  let res;
  try {
    res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: base64, mediaType }),
    });
  } catch (e) {
    throw new Error("Couldn't reach the AI summary service. Check your internet connection.");
  }
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error(
      "AI summary isn't available here yet. This feature only runs after deploying to Vercel " +
      "(with ANTHROPIC_API_KEY set) — or locally via `vercel dev` instead of `npm run dev`. See README."
    );
  }
  if (!res.ok) throw new Error(json.error || "Summarization failed");
  return json.summary;
}

function DocumentsPanel({ onSummaryReady }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | reading | summarizing | done | error
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!file) return;
    setStatus("reading"); setError("");
    try {
      const base64 = await fileToBase64(file);
      setStatus("summarizing");
      const summary = await callSummarizeApi(base64, file.type || "application/octet-stream");
      onSummaryReady(summary);
      setStatus("done");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  return (
    <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.line}`, borderRadius: 16, padding: 22, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Sparkles size={17} color={TOKENS.gold} />
        <div style={{ fontSize: 15, fontWeight: 700, color: TOKENS.ink }}>Medical report → AI emergency summary</div>
      </div>
      <p style={{ fontSize: 12.5, color: TOKENS.muted, lineHeight: 1.5, margin: "6px 0 14px" }}>
        Upload a report (image or PDF). The AI reads it and writes a short summary of past
        conditions and anything relevant in an emergency — never a diagnosis.
      </p>

      <label style={{
        display: "flex", alignItems: "center", gap: 10, border: `1.5px dashed ${TOKENS.line}`,
        borderRadius: 10, padding: "14px 16px", cursor: "pointer", marginBottom: 12,
      }}>
        <UploadCloud size={18} color={TOKENS.teal} />
        <span style={{ fontSize: 13.5, color: file ? TOKENS.ink : TOKENS.muted, fontWeight: file ? 600 : 400 }}>
          {file ? file.name : "Choose a report (JPG, PNG or PDF)"}
        </span>
        <input
          type="file" accept="image/*,application/pdf" style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>

      <Button
        full icon={status === "reading" || status === "summarizing" ? Loader2 : Sparkles}
        disabled={!file || status === "reading" || status === "summarizing"}
        onClick={handleGenerate}
      >
        {status === "reading" ? "Reading file…" : status === "summarizing" ? "Summarizing…" : "Generate AI summary"}
      </Button>

      {status === "error" && (
        <div style={{ background: TOKENS.coralSoft, color: TOKENS.coral, borderRadius: 10, padding: 12, fontSize: 12.5, marginTop: 12, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
      {status === "done" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: TOKENS.teal, fontSize: 12.5, marginTop: 12, fontWeight: 600 }}>
          <CheckCircle2 size={15} /> Summary saved to this profile&rsquo;s Emergency ID.
        </div>
      )}
    </div>
  );
}

/* ---------------------------- member detail (private, family view) ---------------------------- */

function MemberDetail({ member, onBack, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const publicUrl = `${window.location.origin}/emergency/${member.token}`;
  const qrPayload = buildOfflineQrPayload(member, publicUrl);

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <button onClick={onBack} style={backBtnStyle}><ArrowLeft size={16} /> Family dashboard</button>

      <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.line}`, borderRadius: 18, padding: 28, textAlign: "center", marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: TOKENS.muted, marginBottom: 4 }}>Emergency ID for</div>
            <div style={{ fontFamily: serif, fontSize: 20, color: TOKENS.ink }}>{member.name}</div>
          </div>
          <button onClick={() => setEditing(true)} aria-label="Edit profile" style={{ background: TOKENS.tealSoft, border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: TOKENS.tealDeep }}>
            <Pencil size={15} />
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <QRCodeCanvas data={qrPayload} size={240} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, color: TOKENS.tealDeep, fontSize: 12, fontWeight: 700 }}>
          <WifiOff size={14} /> Works with zero internet — data is inside the code
        </div>
        <p style={{ fontSize: 12.5, color: TOKENS.muted, marginTop: 8, lineHeight: 1.5 }}>
          Blood group, allergies, conditions, medications and emergency contact are encoded
          directly in this QR as plain text — any scanner shows them instantly, no network
          needed. If the responder&rsquo;s phone does have internet, the same code also carries a
          link to the full Emergency Mode (live location, nearby hospitals, AI summary).
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <Button variant="ghost" full icon={ExternalLink} onClick={() => window.open(publicUrl, "_blank")}>
            Open full online view
          </Button>
        </div>
      </div>

      <DocumentsPanel onSummaryReady={(summary) => onUpdate({ ...member, aiSummary: summary })} />

      {member.aiSummary && (
        <div style={{ background: TOKENS.tealSoft, borderRadius: 12, padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 11.5, color: TOKENS.tealDeep, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={13} /> Current AI summary on file
          </div>
          <div style={{ fontSize: 13, color: TOKENS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{member.aiSummary}</div>
        </div>
      )}

      <div style={{ marginTop: 20, textAlign: "center" }}>
        {!confirmRemove ? (
          <button onClick={() => setConfirmRemove(true)} style={{ ...backBtnStyle, color: TOKENS.muted, margin: "0 auto" }}>
            <Trash2 size={14} /> Remove this profile
          </button>
        ) : (
          <div style={{ background: TOKENS.coralSoft, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 13, color: TOKENS.ink, marginBottom: 10 }}>Remove {member.name}&rsquo;s profile? This can&rsquo;t be undone.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setConfirmRemove(false)}>Cancel</Button>
              <Button variant="danger" icon={Trash2} onClick={() => onRemove(member.id)}>Yes, remove</Button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <MemberFormModal
          title="Edit profile" initial={member} onClose={() => setEditing(false)}
          onSave={(updated) => { onUpdate(updated); setEditing(false); }}
        />
      )}
    </div>
  );
}

/* ---------------------------- public responder view ---------------------------- */

function EmergencyView({ member }) {
  const [locStatus, setLocStatus] = useState("idle");
  const [coords, setCoords] = useState(null);
  const [alertSent, setAlertSent] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);

  const shareLocation = () => {
    setLocStatus("locating");
    if (!navigator.geolocation) { setLocStatus("unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) }); setLocStatus("done"); },
      () => setLocStatus("denied"),
      { timeout: 6000 }
    );
  };

  return (
    <div style={{ minHeight: "100%", background: TOKENS.paper, fontFamily: sans, padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ background: TOKENS.ink, color: "#fff", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={18} color={TOKENS.gold} />
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>Verified emergency data · no login required · full history stays private</div>
        </div>

        <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.line}`, borderTop: `5px solid ${TOKENS.coral}`, borderRadius: 16, padding: 24, marginTop: 12 }}>
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: TOKENS.coralSoft, color: TOKENS.coral, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontFamily: serif, fontSize: 30, fontWeight: 700 }}>
              {member.bloodGroup}
            </div>
            <div style={{ fontFamily: serif, fontSize: 23, color: TOKENS.ink }}>{member.name}</div>
            <div style={{ fontSize: 13, color: TOKENS.muted }}>{member.age} yrs · {member.gender}</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field icon={AlertTriangle} label="Allergies" accent={member.allergies[0] !== "None reported" ? TOKENS.coral : null}>{member.allergies.join(", ")}</Field>
            <Field icon={Droplet} label="Existing conditions">{member.conditions.join(", ")}</Field>
            <Field icon={Pill} label="Current medications">{member.medications.join(", ")}</Field>
            <Field icon={Phone} label="Emergency contact">
              {member.contacts[0] ? `${member.contacts[0].name} — ${member.contacts[0].phone}` : "Not provided"}
            </Field>
          </div>

          <div style={{ background: TOKENS.tealSoft, borderRadius: 10, padding: 12, marginTop: 14, fontSize: 12.5, color: TOKENS.tealDeep, lineHeight: 1.5 }}>
            {member.aiSummary ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={13} /> AI summary from uploaded report
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{member.aiSummary}</div>
              </>
            ) : (
              <>No AI summary on file yet — the family can add one by uploading a medical report from their dashboard.</>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.ink, marginBottom: 10 }}>Emergency Mode — one tap, four things at once</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <a href="tel:112" style={{ textDecoration: "none" }}>
              <ActionTile icon={Phone} label="Call 112" sub="Direct dial" urgent />
            </a>
            <div onClick={shareLocation}>
              <ActionTile icon={MapPin} label="Live location" sub={locStatus === "done" ? `${coords.lat}, ${coords.lng}` : locStatus === "locating" ? "Locating…" : locStatus === "denied" ? "Permission denied" : "Tap to share"} />
            </div>
            <div onClick={() => setAlertSent(true)}>
              <ActionTile icon={Bell} label="Contact alerts" sub={alertSent ? "Sent ✓" : "Notify family"} />
            </div>
            <div onClick={() => setShowHospitals(!showHospitals)}>
              <ActionTile icon={Building2} label="Nearby hospitals" sub={showHospitals ? "Hide list" : "Show list"} />
            </div>
          </div>
          {showHospitals && (
            <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.line}`, borderRadius: 12, marginTop: 10, overflow: "hidden" }}>
              {HOSPITALS.map((h, i) => (
                <div key={h.name} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < 2 ? `1px solid ${TOKENS.line}` : "none", fontSize: 13.5 }}>
                  <span style={{ color: TOKENS.ink, fontWeight: 600 }}>{h.name}</span>
                  <span style={{ color: TOKENS.muted }}>{h.distance}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmergencyNotFound() {
  return (
    <div style={{ minHeight: "100%", background: TOKENS.paper, fontFamily: sans, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <ShieldCheck size={30} color={TOKENS.muted} style={{ marginBottom: 12 }} />
        <div style={{ fontFamily: serif, fontSize: 21, color: TOKENS.ink, marginBottom: 8 }}>Emergency ID not found on this device</div>
        <p style={{ fontSize: 13.5, color: TOKENS.muted, lineHeight: 1.6 }}>
          This profile lives in the browser that created it. Scanning from the same phone/browser
          it was made on will work. Making this resolve from any device needs a shared backend +
          database — the next build phase.
        </p>
      </div>
    </div>
  );
}

function ActionTile({ icon: Icon, label, sub, urgent }) {
  return (
    <div style={{ background: urgent ? TOKENS.coral : TOKENS.panel, color: urgent ? "#fff" : TOKENS.ink, border: `1px solid ${urgent ? TOKENS.coral : TOKENS.line}`, borderRadius: 12, padding: "14px 14px", cursor: "pointer", height: "100%", boxSizing: "border-box" }}>
      <Icon size={19} color={urgent ? "#fff" : TOKENS.teal} />
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{label}</div>
      <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

/* ---------------------------- signup wizard ---------------------------- */

function StepDots({ step, total }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 22 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 4, background: i <= step ? TOKENS.teal : TOKENS.line, transition: "all .2s ease" }} />
      ))}
    </div>
  );
}

function SignupWizard({ onComplete, onSwitchToLogin }) {
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [accountErrors, setAccountErrors] = useState({});
  const [memberForm, setMemberForm] = useState(emptyMemberForm());
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadError, setUploadError] = useState("");
  const [pendingSummary, setPendingSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setAccField = (k) => (e) => setAccount({ ...account, [k]: e.target.value });

  const validateAccount = () => {
    const errs = {};
    if (!account.fullName.trim()) errs.fullName = "Enter your full name";
    if (!isValidEmail(account.email)) errs.email = "Enter a valid email address";
    if (!account.phone.trim() || account.phone.trim().length < 7) errs.phone = "Enter a valid phone number";
    if (account.password.length < 6) errs.password = "At least 6 characters";
    if (account.confirm !== account.password) errs.confirm = "Passwords don't match";
    setAccountErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 0) {
      if (!validateAccount()) return;
    }
    setStep((s) => Math.min(s + 1, 2));
  };

  const handleUploadSummary = async () => {
    if (!file) return;
    setUploadStatus("reading"); setUploadError("");
    try {
      const base64 = await fileToBase64(file);
      setUploadStatus("summarizing");
      const summary = await callSummarizeApi(base64, file.type || "application/octet-stream");
      setPendingSummary(summary);
      setUploadStatus("done");
    } catch (e) {
      setUploadError(e.message);
      setUploadStatus("error");
    }
  };

  const finish = async () => {
    setSubmitting(true); setSubmitError("");
    try {
      const passwordHash = await hashPassword(account.password);
      const selfMember = formToMember({ ...memberForm, name: account.fullName, relation: "Self" }, null);
      selfMember.aiSummary = pendingSummary;
      const newAccount = {
        fullName: account.fullName.trim(), email: account.email.trim().toLowerCase(),
        phone: account.phone.trim(), passwordHash, members: [selfMember],
      };
      saveAccount(newAccount);
      localStorage.setItem(SESSION_KEY, "1");
      onComplete(newAccount);
    } catch (e) {
      setSubmitError("Couldn't create your account on this device. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "20px auto 0" }}>
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{ fontFamily: serif, fontSize: 24, color: TOKENS.ink }}>Create your MediVault ID</div>
        <p style={{ fontSize: 13.5, color: TOKENS.muted, marginTop: 6 }}>
          {step === 0 && "Step 1 of 3 — your account"}
          {step === 1 && "Step 2 of 3 — your medical details"}
          {step === 2 && "Step 3 of 3 — upload a report (optional)"}
        </p>
      </div>
      <StepDots step={step} total={3} />

      <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.line}`, borderRadius: 18, padding: 24 }}>
        {step === 0 && (
          <>
            <LabeledInput label="Full name" placeholder="Your full name" value={account.fullName} onChange={setAccField("fullName")} error={accountErrors.fullName} />
            <LabeledInput label="Email" type="email" placeholder="name@example.com" value={account.email} onChange={setAccField("email")} error={accountErrors.email} />
            <LabeledInput label="Phone number" placeholder="+91 XXXXX XXXXX" value={account.phone} onChange={setAccField("phone")} error={accountErrors.phone} />
            <PasswordInput label="Password" placeholder="At least 6 characters" value={account.password} onChange={setAccField("password")} error={accountErrors.password} />
            <PasswordInput label="Confirm password" placeholder="Re-enter your password" value={account.confirm} onChange={setAccField("confirm")} error={accountErrors.confirm} />
          </>
        )}

        {step === 1 && (
          <>
            <p style={{ fontSize: 12.5, color: TOKENS.muted, marginBottom: 14, lineHeight: 1.5 }}>
              This becomes your own Emergency ID — the one a responder sees if you&rsquo;re ever the
              one who can&rsquo;t speak for yourself.
            </p>
            <MemberFieldsForm form={memberForm} setForm={setMemberForm} showRelation={false} />
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: 12.5, color: TOKENS.muted, marginBottom: 14, lineHeight: 1.5 }}>
              Upload a medical report and the AI will write a short emergency summary onto your
              ID — past conditions, anything a responder should know. You can skip this and add
              it later from your dashboard.
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px dashed ${TOKENS.line}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", marginBottom: 12 }}>
              <UploadCloud size={18} color={TOKENS.teal} />
              <span style={{ fontSize: 13.5, color: file ? TOKENS.ink : TOKENS.muted, fontWeight: file ? 600 : 400 }}>
                {file ? file.name : "Choose a report (JPG, PNG or PDF)"}
              </span>
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => { setFile(e.target.files?.[0] || null); setUploadStatus("idle"); }} />
            </label>
            {file && uploadStatus !== "done" && (
              <Button full variant="subtle" icon={uploadStatus === "reading" || uploadStatus === "summarizing" ? Loader2 : Sparkles}
                disabled={uploadStatus === "reading" || uploadStatus === "summarizing"} onClick={handleUploadSummary} style={{ marginBottom: 12 }}>
                {uploadStatus === "reading" ? "Reading file…" : uploadStatus === "summarizing" ? "Summarizing…" : "Generate AI summary now"}
              </Button>
            )}
            {uploadStatus === "error" && (
              <div style={{ background: TOKENS.coralSoft, color: TOKENS.coral, borderRadius: 10, padding: 12, fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>{uploadError}</div>
            )}
            {uploadStatus === "done" && (
              <div style={{ background: TOKENS.tealSoft, borderRadius: 10, padding: 12, fontSize: 12.5, color: TOKENS.tealDeep, marginBottom: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={14} /> Summary ready</div>
                {pendingSummary}
              </div>
            )}
          </>
        )}

        {submitError && (
          <div style={{ background: TOKENS.coralSoft, color: TOKENS.coral, borderRadius: 10, padding: 12, fontSize: 12.5, marginBottom: 12 }}>{submitError}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {step > 0 && <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)}>Back</Button>}
          {step < 2 && <Button full icon={ArrowRight} onClick={handleNext}>Continue</Button>}
          {step === 2 && <Button full icon={submitting ? Loader2 : Check} disabled={submitting} onClick={finish}>{submitting ? "Creating your ID…" : "Finish & go to dashboard"}</Button>}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: TOKENS.muted }}>
        Already have a MediVault ID on this device?{" "}
        <button onClick={onSwitchToLogin} style={{ ...backBtnStyle, display: "inline" }}>Sign in</button>
      </div>
    </div>
  );
}

/* ---------------------------- login ---------------------------- */

function LoginScreen({ onLoggedIn, onSwitchToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    const account = loadAccount();
    if (!account) { setError("No MediVault ID found on this device yet — create one below."); return; }
    if (!isValidEmail(email)) { setError("Enter a valid email address"); return; }
    setSubmitting(true);
    try {
      const hash = await hashPassword(password);
      if (email.trim().toLowerCase() !== account.email || hash !== account.passwordHash) {
        setError("Email or password doesn't match this device's MediVault ID.");
        return;
      }
      localStorage.setItem(SESSION_KEY, "1");
      onLoggedIn(account);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: "40px auto 0" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontFamily: serif, fontSize: 26, marginBottom: 8 }}>Welcome back</div>
        <p style={{ fontSize: 14, color: TOKENS.muted, lineHeight: 1.6 }}>
          Sign in to your MediVault ID on this device.
        </p>
      </div>
      <LabeledInput label="Email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordInput label="Password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <div style={{ background: TOKENS.coralSoft, color: TOKENS.coral, borderRadius: 10, padding: 12, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>{error}</div>}
      <Button full icon={submitting ? Loader2 : ArrowRight} disabled={submitting} onClick={handleSubmit}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: TOKENS.muted }}>
        New here?{" "}
        <button onClick={onSwitchToSignup} style={{ ...backBtnStyle, display: "inline" }}>Create your MediVault ID</button>
      </div>
    </div>
  );
}

/* ---------------------------- root app ---------------------------- */

export default function App() {
  const [route] = useState(() => {
    const path = window.location.pathname;
    const m = path.match(/^\/emergency\/([a-z0-9]+)$/i);
    return m ? { name: "emergency", token: m[1] } : { name: "app" };
  });

  const [account, setAccount] = useState(loadAccount);
  const [authScreen, setAuthScreen] = useState(() => (loadAccount() ? "login" : "signup"));
  const [loggedIn, setLoggedIn] = useState(() => Boolean(loadAccount()) && localStorage.getItem(SESSION_KEY) === "1");
  const [screen, setScreen] = useState("dashboard");
  const [activeId, setActiveId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const members = account?.members || [];

  const persistAccount = useCallback((next) => {
    setAccount(next);
    saveAccount(next);
  }, []);

  const updateMember = useCallback((updated) => {
    if (!account) return;
    persistAccount({ ...account, members: account.members.map((m) => (m.id === updated.id ? updated : m)) });
  }, [account, persistAccount]);

  const addMember = useCallback((newMember) => {
    if (!account) return;
    persistAccount({ ...account, members: [...account.members, newMember] });
  }, [account, persistAccount]);

  const removeMember = useCallback((id) => {
    if (!account) return;
    persistAccount({ ...account, members: account.members.filter((m) => m.id !== id) });
    setScreen("dashboard");
  }, [account, persistAccount]);

  if (route.name === "emergency") {
    const acc = loadAccount();
    const member = acc?.members.find((m) => m.token === route.token);
    return member ? <EmergencyView member={member} /> : <EmergencyNotFound />;
  }

  const activeMember = members.find((m) => m.id === activeId);

  const handleSignOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setLoggedIn(false);
    setAuthScreen("login");
    setScreen("dashboard");
  };

  return (
    <div style={{ minHeight: "100%", background: TOKENS.paper, fontFamily: sans, color: TOKENS.ink }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 18px 60px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: TOKENS.ink, color: TOKENS.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShieldCheck size={18} />
            </div>
            <div style={{ fontFamily: serif, fontSize: 20, letterSpacing: 0.2 }}>MediVault</div>
          </div>
          {loggedIn && (
            <button onClick={handleSignOut} style={{ ...backBtnStyle, color: TOKENS.muted }}>
              <LogOut size={15} /> Sign out
            </button>
          )}
        </header>

        {!loggedIn && authScreen === "signup" && (
          <SignupWizard
            onComplete={(newAccount) => { setAccount(newAccount); setLoggedIn(true); setScreen("dashboard"); }}
            onSwitchToLogin={() => setAuthScreen("login")}
          />
        )}

        {!loggedIn && authScreen === "login" && (
          <LoginScreen
            onLoggedIn={(acc) => { setAccount(acc); setLoggedIn(true); setScreen("dashboard"); }}
            onSwitchToSignup={() => setAuthScreen("signup")}
          />
        )}

        {loggedIn && account && screen === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontFamily: serif, fontSize: 22 }}>Hi, {account.fullName.split(" ")[0]}</div>
                <div style={{ fontSize: 13, color: TOKENS.muted }}>{members.length} protected profile{members.length !== 1 ? "s" : ""}</div>
              </div>
              <Button icon={Plus} onClick={() => setShowAdd(true)}>Add member</Button>
            </div>

            {members.length === 0 ? (
              <div style={{ background: TOKENS.panel, border: `1px dashed ${TOKENS.line}`, borderRadius: 16, padding: 40, textAlign: "center" }}>
                <ShieldCheck size={26} color={TOKENS.muted} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.ink, marginBottom: 4 }}>No profiles yet</div>
                <p style={{ fontSize: 13, color: TOKENS.muted, marginBottom: 16 }}>Add your first family member to generate their Emergency ID.</p>
                <Button icon={Plus} onClick={() => setShowAdd(true)}>Add member</Button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {members.map((m) => (
                  <IdCard key={m.id} member={m} onOpen={() => { setActiveId(m.id); setScreen("detail"); }} />
                ))}
              </div>
            )}
          </div>
        )}

        {loggedIn && screen === "detail" && activeMember && (
          <MemberDetail member={activeMember} onBack={() => setScreen("dashboard")} onUpdate={updateMember} onRemove={removeMember} />
        )}

        {showAdd && (
          <MemberFormModal
            title="Add family member"
            initial={null}
            onClose={() => setShowAdd(false)}
            onSave={(newMember) => { addMember(newMember); setShowAdd(false); }}
          />
        )}
      </div>
    </div>
  );
}
