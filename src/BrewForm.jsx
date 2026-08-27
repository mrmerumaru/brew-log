import React, { useState, useMemo, useRef, useEffect } from "react";
import { Camera, Share2, Check, Coffee, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import {
  TOKENS,
  SANS,
  MONO,
  SERIF,
  METHODS,
  PROCESSES,
  ROASTS,
  FLAVORS,
  PHOTO_BUCKET,
} from "./tokens";

const DEFAULTS = {
  method: "Pourover",
  machineBrand: "",
  machineModel: "",
  grinder: "",
  beanName: "",
  origin: "",
  process: "Washed",
  roast: "Medium",
  dose: "18",
  water: "290",
  temp: "94",
  time: "2:45",
  flavors: ["Fruity"],
  rating: 4,
  notes: "",
};

// The Time field is labelled "min" and defaults to "2:45", so:
//   "2:45" -> 165s   (m:ss, the common case)
//   "2.5"  -> 150s   (bare number = decimal minutes, matching the label)
// Returns null for anything unparseable, so the column stays null rather than 0.
export function parseBrewTime(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (value.includes(":")) {
    const [m, s] = value.split(":");
    const minutes = parseInt(m, 10);
    const seconds = parseInt(s, 10);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return minutes * 60 + seconds;
  }

  const minutes = parseFloat(value);
  if (Number.isNaN(minutes)) return null;
  return Math.round(minutes * 60);
}

// The implementation guides hardcode ".jpg"; derive the real extension so a
// PNG or HEIC upload isn't stored under a misleading name.
export function fileExtension(file) {
  const fromName = file?.name?.includes(".") ? file.name.split(".").pop() : null;
  if (fromName && /^[a-z0-9]{1,5}$/i.test(fromName)) return fromName.toLowerCase();
  const fromType = file?.type?.split("/")[1];
  if (fromType && /^[a-z0-9]{1,5}$/i.test(fromType)) return fromType.toLowerCase();
  return "jpg";
}

// parseFloat("") is NaN, which Postgres rejects for a numeric column.
function num(value) {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function StepLabel({ n, title, done }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] shrink-0"
        style={{
          fontFamily: MONO,
          background: done ? TOKENS.green : "transparent",
          color: done ? TOKENS.card : TOKENS.inkFaint,
          border: `1px solid ${done ? TOKENS.green : TOKENS.rule}`,
        }}
      >
        {done ? <Check size={13} strokeWidth={2.5} /> : String(n).padStart(2, "0")}
      </span>
      <h3
        className="text-[13px] tracking-[0.12em] uppercase"
        style={{ fontFamily: SANS, fontWeight: 700, color: TOKENS.ink }}
      >
        {title}
      </h3>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-[13px] rounded-full transition-colors duration-150"
      style={{
        fontFamily: SERIF,
        border: `1px solid ${active ? TOKENS.green : TOKENS.rule}`,
        background: active ? TOKENS.greenSoft : "transparent",
        color: active ? TOKENS.green : TOKENS.inkFaint,
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, mono, suffix }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="text-[10px] tracking-[0.1em] uppercase"
        style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none pb-1.5 text-[14px]"
          style={{
            fontFamily: mono ? MONO : SERIF,
            color: TOKENS.ink,
            borderBottom: `1px solid ${TOKENS.rule}`,
          }}
        />
        {suffix && (
          <span style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.inkFaint }}>
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function Divider() {
  return <div className="my-7" style={{ borderTop: `1px dashed ${TOKENS.rule}` }} />;
}

export default function BrewForm({ onSaved }) {
  const [method, setMethod] = useState(DEFAULTS.method);
  const [machineBrand, setMachineBrand] = useState(DEFAULTS.machineBrand);
  const [machineModel, setMachineModel] = useState(DEFAULTS.machineModel);
  const [grinder, setGrinder] = useState(DEFAULTS.grinder);
  const [beanName, setBeanName] = useState(DEFAULTS.beanName);
  const [origin, setOrigin] = useState(DEFAULTS.origin);
  const [process, setProcess] = useState(DEFAULTS.process);
  const [roast, setRoast] = useState(DEFAULTS.roast);
  const [dose, setDose] = useState(DEFAULTS.dose);
  const [water, setWater] = useState(DEFAULTS.water);
  const [temp, setTemp] = useState(DEFAULTS.temp);
  const [time, setTime] = useState(DEFAULTS.time);
  const [flavors, setFlavors] = useState(DEFAULTS.flavors);
  const [rating, setRating] = useState(DEFAULTS.rating);
  const [notes, setNotes] = useState(DEFAULTS.notes);

  const [photo, setPhoto] = useState(null); // preview object URL
  const [photoFile, setPhotoFile] = useState(null); // the actual File, needed to upload
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const savedTimerRef = useRef(null);

  const ratio = useMemo(() => {
    const d = parseFloat(dose);
    const w = parseFloat(water);
    if (!d || !w) return "—";
    return `1 : ${(w / d).toFixed(1)}`;
  }, [dose, water]);

  // Object URLs leak until revoked; release the previous one whenever the photo
  // changes or the form unmounts.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo);
    };
  }, [photo]);

  // Kept separate from the photo cleanup above: saving clears the photo, and a
  // shared cleanup would cancel the "Saved ✓" timer the moment it was set.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const toggleFlavor = (f) =>
    setFlavors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(file));
    setPhotoFile(file); // the preview URL can't be uploaded — keep the File too
  };

  const resetForm = () => {
    setMethod(DEFAULTS.method);
    setMachineBrand(DEFAULTS.machineBrand);
    setMachineModel(DEFAULTS.machineModel);
    setGrinder(DEFAULTS.grinder);
    setBeanName(DEFAULTS.beanName);
    setOrigin(DEFAULTS.origin);
    setProcess(DEFAULTS.process);
    setRoast(DEFAULTS.roast);
    setDose(DEFAULTS.dose);
    setWater(DEFAULTS.water);
    setTemp(DEFAULTS.temp);
    setTime(DEFAULTS.time);
    setFlavors(DEFAULTS.flavors);
    setRating(DEFAULTS.rating);
    setNotes(DEFAULTS.notes);
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You're not signed in any more. Reload the page and sign in again.");
        return;
      }

      const { data: brew, error: insertError } = await supabase
        .from("brews")
        .insert({
          user_id: user.id,
          method,
          machine_brand: machineBrand,
          machine_model: machineModel,
          grinder,
          bean_name: beanName,
          origin,
          process,
          roast_level: roast,
          dose_g: num(dose),
          water_g: num(water),
          water_temp_c: num(temp),
          brew_time_s: parseBrewTime(time),
          flavor_tags: flavors,
          rating,
          notes,
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      if (photoFile) {
        const path = `${user.id}/${brew.id}.${fileExtension(photoFile)}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, photoFile, { contentType: photoFile.type || undefined });

        if (uploadError) {
          // The brew itself is already saved — say so rather than implying total failure.
          setError(`Brew saved, but the photo didn't upload: ${uploadError.message}`);
          onSaved?.();
          return;
        }

        const { error: pathError } = await supabase
          .from("brews")
          .update({ photo_path: path })
          .eq("id", brew.id);

        if (pathError) {
          setError(`Brew and photo saved, but linking them failed: ${pathError.message}`);
          onSaved?.();
          return;
        }
      }

      setSaved(true);
      resetForm();
      onSaved?.();
      savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.message ?? "Something went wrong saving this brew.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="w-full max-w-[480px] rounded-sm"
      style={{
        background: TOKENS.card,
        border: `1px solid ${TOKENS.rule}`,
        boxShadow: "0 1px 2px rgba(32,29,26,0.04)",
      }}
    >
      {/* Header */}
      <div
        className="px-6 pt-6 pb-5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${TOKENS.rule}` }}
      >
        <div className="flex items-center gap-2">
          <Coffee size={16} style={{ color: TOKENS.green }} strokeWidth={2} />
          <span
            className="text-[15px]"
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              color: TOKENS.ink,
              letterSpacing: "0.01em",
            }}
          >
            Brew Log
          </span>
        </div>
        <div className="text-right">
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: TOKENS.inkFaint,
              letterSpacing: "0.08em",
            }}
          >
            RATIO
          </div>
          <div
            style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: TOKENS.amber }}
          >
            {ratio}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* 01 Method */}
        <StepLabel n={1} title="Method" done={!!method} />
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <Chip key={m} label={m} active={method === m} onClick={() => setMethod(m)} />
          ))}
        </div>

        <Divider />

        {/* 02 Equipment */}
        <StepLabel n={2} title="Equipment" done={!!machineBrand || !!grinder} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="Brewer brand" value={machineBrand} onChange={setMachineBrand} placeholder="Hario" />
          <Field label="Brewer model" value={machineModel} onChange={setMachineModel} placeholder="V60-02" />
          <Field label="Grinder" value={grinder} onChange={setGrinder} placeholder="Comandante C40" />
        </div>

        <Divider />

        {/* 03 Beans */}
        <StepLabel n={3} title="Beans" done={!!beanName} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-4">
          <Field label="Name / roaster" value={beanName} onChange={setBeanName} placeholder="Tim Wendelboe" />
          <Field label="Origin" value={origin} onChange={setOrigin} placeholder="Ethiopia" />
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PROCESSES.map((p) => (
            <Chip key={p} label={p} active={process === p} onClick={() => setProcess(p)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ROASTS.map((r) => (
            <Chip key={r} label={r} active={roast === r} onClick={() => setRoast(r)} />
          ))}
        </div>

        <Divider />

        {/* 04 Parameters */}
        <StepLabel n={4} title="Parameters" done={!!dose && !!water} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="Dose" value={dose} onChange={setDose} mono suffix="g" />
          <Field label="Water" value={water} onChange={setWater} mono suffix="g" />
          <Field label="Temp" value={temp} onChange={setTemp} mono suffix="°C" />
          <Field label="Time" value={time} onChange={setTime} mono suffix="min" />
        </div>

        <Divider />

        {/* 05 Tasting */}
        <StepLabel n={5} title="Tasting Notes" done={flavors.length > 0} />
        <div className="flex flex-wrap gap-2 mb-5">
          {FLAVORS.map((f) => (
            <Chip key={f} label={f} active={flavors.includes(f)} onClick={() => toggleFlavor(f)} />
          ))}
        </div>

        <div className="flex items-center justify-between mb-5">
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: TOKENS.inkFaint,
              letterSpacing: "0.1em",
            }}
          >
            RATING
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                aria-label={`${i} stars`}
                style={{
                  fontFamily: MONO,
                  fontSize: 18,
                  lineHeight: 1,
                  color: i <= rating ? TOKENS.amber : TOKENS.rule,
                }}
              >
                ●
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else worth remembering about this cup…"
          rows={2}
          className="w-full bg-transparent outline-none resize-none text-[14px] pb-1.5"
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            color: TOKENS.ink,
            borderBottom: `1px solid ${TOKENS.rule}`,
          }}
        />

        <Divider />

        {/* Photo + actions */}
        <div className="flex items-center gap-3">
          <label
            className="flex items-center justify-center rounded-sm cursor-pointer overflow-hidden shrink-0"
            style={{
              width: 64,
              height: 64,
              border: `1px dashed ${TOKENS.rule}`,
              background: photo ? "transparent" : TOKENS.paper,
            }}
          >
            {photo ? (
              <img src={photo} alt="Brew" className="w-full h-full object-cover" />
            ) : (
              <Camera size={18} style={{ color: TOKENS.inkFaint }} />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              className="hidden"
            />
          </label>

          <div className="flex-1 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-sm text-[12px] tracking-[0.08em] uppercase flex items-center justify-center gap-2 transition-opacity"
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                background: TOKENS.green,
                color: TOKENS.card,
                opacity: saving ? 0.6 : 1,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save Brew"}
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-11 rounded-sm shrink-0"
              style={{ border: `1px solid ${TOKENS.rule}`, color: TOKENS.rule }}
              aria-label="Share (coming in M3)"
              title="Share card generation comes in M3"
              disabled
            >
              <Share2 size={15} />
            </button>
          </div>
        </div>

        {error && (
          <p
            className="mt-4 text-[13px]"
            style={{ fontFamily: SERIF, color: TOKENS.red }}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
