import React, { useState, useMemo } from "react";
import { Camera, Share2, Check, Coffee } from "lucide-react";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap');
`;

const TOKENS = {
  paper: "#F3F1EC",
  card: "#FBFAF7",
  ink: "#201D1A",
  inkFaint: "#6B6558",
  rule: "#D8D2C4",
  green: "#2F5233",
  greenSoft: "#E4EADF",
  amber: "#C77D2E",
};

const METHODS = ["Pourover", "Moka Pot", "Espresso", "Turkish", "French Press", "AeroPress", "Cold Brew"];
const PROCESSES = ["Washed", "Natural", "Honey", "Anaerobic"];
const ROASTS = ["Light", "Medium", "Dark"];
const FLAVORS = ["Fruity", "Nutty", "Chocolatey", "Floral", "Acidic", "Bitter", "Sweet", "Earthy"];

function StepLabel({ n, title, done }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] shrink-0"
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          background: done ? TOKENS.green : "transparent",
          color: done ? TOKENS.card : TOKENS.inkFaint,
          border: `1px solid ${done ? TOKENS.green : TOKENS.rule}`,
        }}
      >
        {done ? <Check size={13} strokeWidth={2.5} /> : String(n).padStart(2, "0")}
      </span>
      <h3
        className="text-[13px] tracking-[0.12em] uppercase"
        style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: TOKENS.ink }}
      >
        {title}
      </h3>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-[13px] rounded-full transition-colors duration-150"
      style={{
        fontFamily: "'Source Serif 4', serif",
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
        style={{ fontFamily: "'IBM Plex Mono', monospace", color: TOKENS.inkFaint }}
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
            fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Source Serif 4', serif",
            color: TOKENS.ink,
            borderBottom: `1px solid ${TOKENS.rule}`,
          }}
        />
        {suffix && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: TOKENS.inkFaint }}>
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function Divider() {
  return (
    <div
      className="my-7"
      style={{
        borderTop: `1px dashed ${TOKENS.rule}`,
      }}
    />
  );
}

export default function BrewLogMockup() {
  const [method, setMethod] = useState("Pourover");
  const [machineBrand, setMachineBrand] = useState("");
  const [machineModel, setMachineModel] = useState("");
  const [grinder, setGrinder] = useState("");
  const [beanName, setBeanName] = useState("");
  const [origin, setOrigin] = useState("");
  const [process, setProcess] = useState("Washed");
  const [roast, setRoast] = useState("Medium");
  const [dose, setDose] = useState("18");
  const [water, setWater] = useState("290");
  const [temp, setTemp] = useState("94");
  const [time, setTime] = useState("2:45");
  const [flavors, setFlavors] = useState(["Fruity"]);
  const [rating, setRating] = useState(4);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [saved, setSaved] = useState(false);

  const ratio = useMemo(() => {
    const d = parseFloat(dose);
    const w = parseFloat(water);
    if (!d || !w) return "—";
    return `1 : ${(w / d).toFixed(1)}`;
  }, [dose, water]);

  const toggleFlavor = (f) =>
    setFlavors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (file) setPhoto(URL.createObjectURL(file));
  };

  return (
    <div style={{ background: TOKENS.paper, minHeight: "100%" }} className="w-full flex justify-center py-10 px-4">
      <style>{FONT_IMPORT}</style>
      <div
        className="w-full max-w-[480px] rounded-sm"
        style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, boxShadow: "0 1px 2px rgba(32,29,26,0.04)" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${TOKENS.rule}` }}>
          <div className="flex items-center gap-2">
            <Coffee size={16} style={{ color: TOKENS.green }} strokeWidth={2} />
            <span
              className="text-[15px]"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: TOKENS.ink, letterSpacing: "0.01em" }}
            >
              Brew Log
            </span>
          </div>
          <div className="text-right">
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: TOKENS.inkFaint, letterSpacing: "0.08em" }}>
              RATIO
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600, color: TOKENS.amber }}>
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
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: TOKENS.inkFaint, letterSpacing: "0.1em" }}>
              RATING
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  onClick={() => setRating(i)}
                  aria-label={`${i} stars`}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
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
              fontFamily: "'Source Serif 4', serif",
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
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>

            <div className="flex-1 flex gap-2">
              <button
                onClick={() => setSaved(true)}
                className="flex-1 py-2.5 rounded-sm text-[12px] tracking-[0.08em] uppercase transition-opacity"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  background: TOKENS.green,
                  color: TOKENS.card,
                }}
              >
                {saved ? "Saved ✓" : "Save Brew"}
              </button>
              <button
                className="flex items-center justify-center w-11 rounded-sm shrink-0"
                style={{ border: `1px solid ${TOKENS.rule}`, color: TOKENS.ink }}
                aria-label="Share"
              >
                <Share2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
