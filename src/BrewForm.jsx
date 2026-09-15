import React, { useState, useMemo, useRef, useEffect, useId } from "react";
import { Camera, Share2, Check, Coffee, Loader2, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import {
  TOKENS,
  SANS,
  MONO,
  SERIF,
  BEAN_TYPES,
  DRINKS,
  GRIND_UNITS,
  MILK_TYPES,
  METHODS,
  PROCESSES,
  ROASTS,
  FLAVORS,
  PHOTO_BUCKET,
} from "./tokens";
import {
  splitSeconds,
  joinSeconds,
  componentsFromBrew,
  poursFromBrew,
  poursToPayload,
  pourTotals,
  pourTotal,
  BLANK_POUR,
  MAX_POURS,
  componentsToPayload,
  percentTotal,
  BLANK_COMPONENT,
  MAX_BLEND_COMPONENTS,
  fileExtension,
  num,
  dateOrNull,
  isObjectUrl,
} from "./brew";
import ShareSheet from "./ShareSheet";

const DEFAULTS = {
  drink: "",
  methodChoice: "Pourover",
  customMethod: "",
  machineBrand: "",
  machineModel: "",
  grinder: "",
  grindSize: "",
  grindUnit: "",
  beanName: "",
  beanType: "",
  components: [{ ...BLANK_COMPONENT }, { ...BLANK_COMPONENT }],
  origin: "",
  process: "Washed",
  roast: "Medium",
  roastDate: "",
  milkBrand: "",
  milkType: "",
  dose: "18",
  water: "290",
  temp: "94",
  timeMin: "2",
  timeSec: "45",
  pours: [{ ...BLANK_POUR }],
  flavors: ["Fruity"],
  rating: 4,
  notes: "",
};

const METHOD_OTHER = "Other";

// `method` is stored as the real value ("Siphon"), never as the literal
// "Other" — so the history filter chips and share cards read naturally. That
// means reloading a brew has to work out whether its method was one of the
// preset chips or something typed by hand.
function splitMethod(method) {
  const value = method ?? "";
  if (!value) return { methodChoice: DEFAULTS.methodChoice, customMethod: "" };
  if (METHODS.includes(value)) return { methodChoice: value, customMethod: "" };
  return { methodChoice: METHOD_OTHER, customMethod: value };
}

// Maps a saved row back onto the form's state shape. Numbers become strings
// because the inputs are text fields, and brew_time_s splits into two boxes.
function formStateFromBrew(brew) {
  return {
    drink: brew.drink ?? "",
    ...splitMethod(brew.method),
    machineBrand: brew.machine_brand ?? "",
    machineModel: brew.machine_model ?? "",
    grinder: brew.grinder ?? "",
    grindSize: brew.grind_size == null ? "" : String(brew.grind_size),
    grindUnit: brew.grind_unit ?? "",
    beanName: brew.bean_name ?? "",
    beanType: brew.bean_type ?? "",
    components: componentsFromBrew(brew),
    origin: brew.origin ?? "",
    process: brew.process ?? DEFAULTS.process,
    roast: brew.roast_level ?? DEFAULTS.roast,
    roastDate: brew.roast_date ?? "",
    milkBrand: brew.milk_brand ?? "",
    milkType: brew.milk_type ?? "",
    dose: brew.dose_g == null ? "" : String(brew.dose_g),
    water: brew.water_g == null ? "" : String(brew.water_g),
    temp: brew.water_temp_c == null ? "" : String(brew.water_temp_c),
    ...splitSeconds(brew.brew_time_s),
    pours: poursFromBrew(brew),
    flavors: brew.flavor_tags ?? [],
    rating: brew.rating ?? 0,
    notes: brew.notes ?? "",
  };
}

// Carrying a setup forward to a *new* brew: keep method, equipment, beans and
// parameters (the tedious, slow-changing parts) but clear the tasting notes and
// photo, which describe one specific cup and must never be inherited.
function carriedForwardFrom(brew) {
  return {
    ...formStateFromBrew(brew),
    flavors: DEFAULTS.flavors,
    rating: DEFAULTS.rating,
    notes: "",
  };
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  suffix,
  suggestions,
  type = "text",
  // "numeric" / "decimal" make phones open a number pad instead of the full
  // keyboard — no layout switching to reach digits or a decimal point.
  inputMode,
}) {
  // A native <datalist> gives autocomplete without a custom dropdown, and still
  // lets you type a value that isn't in the list.
  const listId = useId();
  const hasSuggestions = suggestions?.length > 0;

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
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          list={hasSuggestions ? listId : undefined}
          className="w-full bg-transparent outline-none pb-1.5 text-[14px]"
          style={{
            // Date inputs render their own picker UI; mono keeps the digits
            // aligned with the other numeric fields.
            fontFamily: mono || type === "date" ? MONO : SERIF,
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
      {hasSuggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </label>
  );
}

function Divider() {
  return <div className="my-7" style={{ borderTop: `1px dashed ${TOKENS.rule}` }} />;
}

// `brew` null = logging a new brew. `brew` set = editing that saved row.
// App gives this component a key tied to the brew id, so switching between
// modes remounts it and these initial values are re-read.
export default function BrewForm({
  brew = null,
  initialPhotoUrl = null,
  previousBrew = null,
  suggestions = {},
  onSaved,
  onExitEdit,
}) {
  const isEditing = Boolean(brew);
  const init = isEditing
    ? formStateFromBrew(brew)
    : previousBrew
      ? carriedForwardFrom(previousBrew)
      : DEFAULTS;

  const [drink, setDrink] = useState(init.drink);
  const [methodChoice, setMethodChoice] = useState(init.methodChoice);
  const [customMethod, setCustomMethod] = useState(init.customMethod);
  const [machineBrand, setMachineBrand] = useState(init.machineBrand);
  const [machineModel, setMachineModel] = useState(init.machineModel);
  const [grinder, setGrinder] = useState(init.grinder);
  const [grindSize, setGrindSize] = useState(init.grindSize);
  const [grindUnit, setGrindUnit] = useState(init.grindUnit);
  const [beanName, setBeanName] = useState(init.beanName);
  const [beanType, setBeanType] = useState(init.beanType);
  const [components, setComponents] = useState(init.components);
  const [origin, setOrigin] = useState(init.origin);
  const [process, setProcess] = useState(init.process);
  const [roast, setRoast] = useState(init.roast);
  const [roastDate, setRoastDate] = useState(init.roastDate);
  const [milkBrand, setMilkBrand] = useState(init.milkBrand);
  const [milkType, setMilkType] = useState(init.milkType);
  const [dose, setDose] = useState(init.dose);
  const [water, setWater] = useState(init.water);
  const [temp, setTemp] = useState(init.temp);
  const [timeMin, setTimeMin] = useState(init.timeMin);
  const [timeSec, setTimeSec] = useState(init.timeSec);
  const [pours, setPours] = useState(init.pours);
  const [flavors, setFlavors] = useState(init.flavors);
  const [rating, setRating] = useState(init.rating);
  const [notes, setNotes] = useState(init.notes);

  // In edit mode this starts as a signed URL from Storage; it only becomes a
  // blob: URL if a replacement file is picked. isObjectUrl keeps the two apart
  // so we never try to revoke a remote URL.
  const [photo, setPhoto] = useState(initialPhotoUrl);
  const [photoFile, setPhotoFile] = useState(null); // the actual File, needed to upload
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  // The brew most recently saved from this form, kept so the share button can
  // act on it after the fields have been cleared. { row, photoBlob }
  const [lastSaved, setLastSaved] = useState(null);
  const [sharing, setSharing] = useState(false);
  // Whether the fields on screen came from a previous brew rather than being
  // typed fresh — drives the "carried over" banner.
  const [carried, setCarried] = useState(!isEditing && Boolean(previousBrew));

  const fileInputRef = useRef(null);
  const savedTimerRef = useRef(null);

  // Your own drinks first (most recent first, from suggestionsFrom), then the
  // starter list for anything you haven't logged yet.
  const drinkSuggestions = useMemo(() => {
    const mine = suggestions.drink ?? [];
    const seen = new Set(mine.map((d) => d.toLowerCase()));
    return [...mine, ...DRINKS.filter((d) => !seen.has(d.toLowerCase()))];
  }, [suggestions.drink]);

  const isBlend = beanType === "Blend";
  const blendTotal = percentTotal(components);
  // At least one component actually identified, for the step's done tick.
  const blendNamed = components.some((c) => c.origin?.trim() || c.name?.trim());

  const updateComponent = (index, key, value) =>
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)));

  const addComponent = () =>
    setComponents((prev) =>
      prev.length >= MAX_BLEND_COMPONENTS ? prev : [...prev, { ...BLANK_COMPONENT }],
    );

  // Two is the floor — a blend of one is a single origin, and the remove
  // buttons are hidden at that point.
  const removeComponent = (index) =>
    setComponents((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));

  const isOtherMethod = methodChoice === METHOD_OTHER;
  // What actually gets saved. Falls back to "Other" so picking the chip and
  // typing nothing still records something rather than an empty method.
  const method = isOtherMethod ? customMethod.trim() || METHOD_OTHER : methodChoice;

  // The pour schedule is a pourover concept; other methods don't show it.
  // Must stay below `method` — reading a const before its declaration throws
  // "Cannot access 'method' before initialization" on every render, which with
  // no error boundary unmounts the whole app and leaves a blank page.
  const isPourover = method === "Pourover";
  const pourRunningTotals = pourTotals(pours);
  const poursWater = pourTotal(pours);

  const updatePour = (index, key, value) =>
    setPours((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));

  const addPour = () =>
    setPours((prev) => (prev.length >= MAX_POURS ? prev : [...prev, { ...BLANK_POUR }]));

  // Pour 1 can't be removed — a pourover has at least one pour.
  const removePour = (index) =>
    setPours((prev) => (index === 0 ? prev : prev.filter((_, i) => i !== index)));

  // Only the hand-typed methods — the preset ones already have their own chips.
  const customMethodSuggestions = useMemo(
    () => (suggestions.method ?? []).filter((m) => !METHODS.includes(m)),
    [suggestions.method],
  );

  const grindUnitSuggestions = useMemo(() => {
    const mine = suggestions.grindUnit ?? [];
    const seen = new Set(mine.map((u) => u.toLowerCase()));
    return [...mine, ...GRIND_UNITS.filter((u) => !seen.has(u.toLowerCase()))];
  }, [suggestions.grindUnit]);

  const milkTypeSuggestions = useMemo(() => {
    const mine = suggestions.milkType ?? [];
    const seen = new Set(mine.map((d) => d.toLowerCase()));
    return [...mine, ...MILK_TYPES.filter((d) => !seen.has(d.toLowerCase()))];
  }, [suggestions.milkType]);

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
      if (isObjectUrl(photo)) URL.revokeObjectURL(photo);
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
    if (isObjectUrl(photo)) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(file));
    setPhotoFile(file); // the preview URL can't be uploaded — keep the File too
  };

  const applyFields = (s) => {
    setDrink(s.drink);
    setMethodChoice(s.methodChoice);
    setCustomMethod(s.customMethod);
    setMachineBrand(s.machineBrand);
    setMachineModel(s.machineModel);
    setGrinder(s.grinder);
    setGrindSize(s.grindSize);
    setGrindUnit(s.grindUnit);
    setBeanName(s.beanName);
    setBeanType(s.beanType);
    setComponents(s.components);
    setOrigin(s.origin);
    setProcess(s.process);
    setRoast(s.roast);
    setRoastDate(s.roastDate);
    setMilkBrand(s.milkBrand);
    setMilkType(s.milkType);
    setDose(s.dose);
    setWater(s.water);
    setTemp(s.temp);
    setTimeMin(s.timeMin);
    setTimeSec(s.timeSec);
    setPours(s.pours);
    setFlavors(s.flavors);
    setRating(s.rating);
    setNotes(s.notes);
  };

  const clearPhoto = () => {
    if (isObjectUrl(photo)) URL.revokeObjectURL(photo);
    setPhoto(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // After saving, keep the setup on screen for the next cup rather than wiping
  // it — same equipment and beans is the common case, a different one is not.
  const resetAfterSave = (row) => {
    applyFields(carriedForwardFrom(row));
    clearPhoto();
    setCarried(true);
  };

  const startBlank = () => {
    applyFields(DEFAULTS);
    clearPhoto();
    setCarried(false);
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

      // Same column values either way; only user_id differs, and an edit must
      // never reassign ownership.
      const fields = {
        drink,
        method,
        machine_brand: machineBrand,
        machine_model: machineModel,
        grinder,
        grind_size: num(grindSize),
        grind_unit: grindUnit,
        // null rather than "" so "not recorded" stays distinguishable.
        bean_type: beanType || null,
        // The roastery applies to the whole bag, blend or not, so bean_name is
        // always kept. Only origin and process are per-component in a blend,
        // and those are cleared so the two representations can never hold
        // contradictory versions of the same beans.
        bean_name: beanName,
        origin: isBlend ? null : origin,
        process: isBlend ? null : process,
        blend_components: isBlend ? componentsToPayload(components) : null,
        roast_level: roast,
        roast_date: dateOrNull(roastDate),
        milk_brand: milkBrand,
        milk_type: milkType,
        dose_g: num(dose),
        water_g: num(water),
        water_temp_c: num(temp),
        brew_time_s: joinSeconds(timeMin, timeSec),
        // Only pourover has a schedule; every other method stores null.
        pours: isPourover ? poursToPayload(pours) : null,
        flavor_tags: flavors,
        rating,
        notes,
      };

      const { data: row, error: writeError } = isEditing
        ? await supabase.from("brews").update(fields).eq("id", brew.id).select().single()
        : await supabase
            .from("brews")
            .insert({ user_id: user.id, ...fields })
            .select()
            .single();

      if (writeError) {
        setError(writeError.message);
        return;
      }

      const verb = isEditing ? "Changes saved" : "Brew saved";

      if (photoFile) {
        const path = `${user.id}/${row.id}.${fileExtension(photoFile)}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          // upsert so replacing a photo on an existing brew overwrites cleanly
          // instead of failing on a name that already exists.
          .upload(path, photoFile, {
            contentType: photoFile.type || undefined,
            upsert: true,
          });

        if (uploadError) {
          // The brew row is already written — say so rather than implying total failure.
          setError(`${verb}, but the photo didn't upload: ${uploadError.message}`);
          onSaved?.();
          return;
        }

        // A replacement with a different extension lands at a new path, leaving
        // the old file orphaned in the bucket. Clean it up (best effort).
        const previousPath = isEditing ? brew.photo_path : null;
        if (previousPath && previousPath !== path) {
          await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);
        }

        if (path !== row.photo_path) {
          const { error: pathError } = await supabase
            .from("brews")
            .update({ photo_path: path })
            .eq("id", row.id);

          if (pathError) {
            setError(`${verb} and photo uploaded, but linking them failed: ${pathError.message}`);
            onSaved?.();
            return;
          }
        }
      }

      onSaved?.();

      if (isEditing) {
        // Nothing to reset — hand the user back to the list they came from.
        onExitEdit?.();
        return;
      }

      // Captured before resetForm clears the fields, so Share can still act on
      // this brew once the form is blank again.
      setLastSaved({ row, photoBlob: photoFile });
      setSaved(true);
      resetAfterSave(row);
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
            {isEditing ? "Edit Brew" : "Brew Log"}
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

      {carried && !isEditing && (
        <div
          className="px-6 py-2.5 flex items-center justify-between gap-3"
          style={{ background: TOKENS.greenSoft, borderBottom: `1px solid ${TOKENS.rule}` }}
        >
          <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.green, letterSpacing: "0.08em" }}>
            SETUP CARRIED OVER
          </span>
          <button
            type="button"
            onClick={startBlank}
            className="text-[10px] uppercase tracking-[0.08em]"
            style={{ fontFamily: MONO, color: TOKENS.green, textDecoration: "underline" }}
          >
            Start blank
          </button>
        </div>
      )}

      <div className="px-6 py-6">
        {/* 01 Drink */}
        <StepLabel n={1} title="Drink" done={!!drink} />
        <Field
          label="What did you make?"
          value={drink}
          onChange={setDrink}
          placeholder="Iced Latte"
          suggestions={drinkSuggestions}
        />

        <Divider />

        {/* 02 Method */}
        <StepLabel n={2} title="Method" done={!!method} />
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <Chip
              key={m}
              label={m}
              active={methodChoice === m}
              onClick={() => setMethodChoice(m)}
            />
          ))}
          {/* Rendered separately, not part of METHODS — "Other" is an
              affordance, never a stored value. */}
          <Chip
            label={METHOD_OTHER}
            active={isOtherMethod}
            onClick={() => setMethodChoice(METHOD_OTHER)}
          />
        </div>

        {isOtherMethod && (
          <div className="mt-4">
            <Field
              label="Which method?"
              value={customMethod}
              onChange={setCustomMethod}
              placeholder="Siphon"
              suggestions={customMethodSuggestions}
            />
          </div>
        )}

        <Divider />

        {/* 03 Equipment */}
        <StepLabel n={3} title="Equipment" done={!!machineBrand || !!grinder} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field
            label="Brewer brand"
            value={machineBrand}
            onChange={setMachineBrand}
            placeholder="Hario"
            suggestions={suggestions.machineBrand}
          />
          <Field
            label="Brewer model"
            value={machineModel}
            onChange={setMachineModel}
            placeholder="V60-02"
            suggestions={suggestions.machineModel}
          />
          <Field
            label="Grinder"
            value={grinder}
            onChange={setGrinder}
            placeholder="Comandante C40"
            suggestions={suggestions.grinder}
          />
        </div>

        <Divider />

        {/* 04 Beans */}
        <StepLabel n={4} title="Beans" done={isBlend ? blendNamed : !!beanName} />

        {/* Single origin vs blend leads the section, since it decides which
            fields follow. Tapping the active chip clears it, so a bag you're
            unsure about stays unrecorded rather than being guessed. */}
        <div className="flex flex-wrap gap-2 mb-5">
          {BEAN_TYPES.map((t) => (
            <Chip
              key={t}
              label={t}
              active={beanType === t}
              onClick={() => setBeanType(beanType === t ? "" : t)}
            />
          ))}
        </div>

        {isBlend ? (
          <>
            {/* The roastery covers the whole bag — a blend is sold as one bag
                by one roaster — so it sits above the per-bean rows. */}
            <div className="mb-5">
              <Field
                label="Roastery"
                value={beanName}
                onChange={setBeanName}
                placeholder="Elephant Grounds"
                suggestions={suggestions.beanName}
              />
            </div>

            {components.map((c, i) => (
              <div
                key={i}
                className="mb-4 pb-4"
                style={
                  i < components.length - 1 ? { borderBottom: `1px dashed ${TOKENS.rule}` } : undefined
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: TOKENS.inkFaint,
                      letterSpacing: "0.1em",
                    }}
                  >
                    BEAN {i + 1}
                  </span>
                  {components.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeComponent(i)}
                      aria-label={`Remove bean ${i + 1}`}
                      style={{ color: TOKENS.rule }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <Field
                    label="Origin"
                    value={c.origin}
                    onChange={(v) => updateComponent(i, "origin", v)}
                    placeholder="Brazil"
                    suggestions={suggestions.origin}
                  />
                  <Field
                    label="Share"
                    value={c.percent}
                    onChange={(v) => updateComponent(i, "percent", v)}
                    placeholder="50"
                    mono
                    inputMode="decimal"
                    suffix="%"
                  />
                  {/* A specific lot or varietal, if the bag names one. Shown on
                      the share card only when this component has no origin. */}
                  <Field
                    label="Lot / bean"
                    value={c.name}
                    onChange={(v) => updateComponent(i, "name", v)}
                    placeholder="Optional"
                  />
                  {/* A datalist rather than chips: process repeats per bean, and
                      four chip rows per component would swamp the form. */}
                  <Field
                    label="Process"
                    value={c.process}
                    onChange={(v) => updateComponent(i, "process", v)}
                    placeholder="Natural"
                    suggestions={PROCESSES}
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between mb-5">
              {components.length < MAX_BLEND_COMPONENTS ? (
                <button
                  type="button"
                  onClick={addComponent}
                  className="text-[10px] uppercase tracking-[0.08em]"
                  style={{ fontFamily: MONO, color: TOKENS.green, textDecoration: "underline" }}
                >
                  + Add bean
                </button>
              ) : (
                <span />
              )}
              {/* Advisory only — 50/50 approximations are normal and shouldn't
                  block a save. */}
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  color: blendTotal === 100 ? TOKENS.green : TOKENS.inkFaint,
                }}
              >
                TOTAL {blendTotal}%
                {blendTotal !== 100 && blendTotal > 0 ? " ✳" : ""}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-4">
              <Field
                label="Name / roaster"
                value={beanName}
                onChange={setBeanName}
                placeholder="Tim Wendelboe"
                suggestions={suggestions.beanName}
              />
              <Field
                label="Origin"
                value={origin}
                onChange={setOrigin}
                placeholder="Ethiopia"
                suggestions={suggestions.origin}
              />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {PROCESSES.map((p) => (
                <Chip key={p} label={p} active={process === p} onClick={() => setProcess(p)} />
              ))}
            </div>
          </>
        )}

        {/* Roast level and date apply to the bag either way — a blend is
            roasted as one. */}
        <div className="grid grid-cols-2 gap-x-4 mb-4">
          <Field label="Roast date" type="date" value={roastDate} onChange={setRoastDate} />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROASTS.map((r) => (
            <Chip key={r} label={r} active={roast === r} onClick={() => setRoast(r)} />
          ))}
        </div>

        <Divider />

        {/* 05 Milk — optional; a long black just leaves this blank */}
        <StepLabel n={5} title="Milk" done={!!milkBrand || !!milkType} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field
            label="Brand"
            value={milkBrand}
            onChange={setMilkBrand}
            placeholder="Greenfields"
            suggestions={suggestions.milkBrand}
          />
          <Field
            label="Kind"
            value={milkType}
            onChange={setMilkType}
            placeholder="Fresh Milk"
            suggestions={milkTypeSuggestions}
          />
        </div>

        <Divider />

        {/* 06 Parameters */}
        <StepLabel n={6} title="Parameters" done={!!dose && !!water} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field
            label="Dose"
            value={dose}
            onChange={setDose}
            mono
            suffix="g"
            inputMode="decimal"
          />
          <Field
            label="Water"
            value={water}
            onChange={setWater}
            mono
            suffix="g"
            inputMode="decimal"
          />
          <Field
            label="Temp"
            value={temp}
            onChange={setTemp}
            mono
            suffix="°C"
            inputMode="decimal"
          />
          {/* Two integer boxes instead of one "m:ss" field — no colon to reach
              for, and seconds over 59 roll up on save. */}
          <div className="grid grid-cols-2 gap-x-3">
            <Field
              label="Time"
              value={timeMin}
              onChange={setTimeMin}
              mono
              suffix="min"
              inputMode="numeric"
              placeholder="2"
            />
            <Field
              // Blank label keeps this box aligned with the Time box beside it.
              label={" "}
              value={timeSec}
              onChange={setTimeSec}
              mono
              suffix="sec"
              inputMode="numeric"
              placeholder="45"
            />
          </div>

          {/* Grind size and its unit stay side by side: the number is
              meaningless without knowing whether it counts clicks, dial
              numbers or microns. */}
          <Field
            label="Grind size"
            value={grindSize}
            onChange={setGrindSize}
            placeholder="18"
            mono
            inputMode="decimal"
          />
          <Field
            label="Unit"
            value={grindUnit}
            onChange={setGrindUnit}
            placeholder="clicks"
            suggestions={grindUnitSuggestions}
          />
        </div>

        {/* Pour schedule — pourover only. A pourover is several pours, and the
            single Water/Time pair above describes the brew as a whole. */}
        {isPourover && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-1">
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: TOKENS.inkFaint,
                  letterSpacing: "0.1em",
                }}
              >
                POURS
              </span>
              {poursWater > 0 && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    // Advisory only: the pours should add up to the water above,
                    // but a rough log is better than a blocked save.
                    color: num(water) === poursWater ? TOKENS.green : TOKENS.inkFaint,
                  }}
                >
                  {poursWater}g TOTAL
                  {num(water) != null && num(water) !== poursWater ? " \u2733" : ""}
                </span>
              )}
            </div>

            {/* Pour 1 is expected but not enforced — the save goes through
                either way, since a partial log beats an abandoned one. */}
            {num(pours[0]?.water) == null && (
              <p className="text-[12px] mt-1" style={{ fontFamily: SERIF, color: TOKENS.amber }}>
                Pour 1 has no water recorded — this brew won't be reproducible.
              </p>
            )}

            {pours.map((p, i) => (
              <div
                key={i}
                className="pt-3 mt-3"
                style={{ borderTop: `1px dashed ${TOKENS.rule}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    style={{ fontFamily: MONO, fontSize: 9, color: TOKENS.inkFaint, letterSpacing: "0.1em" }}
                  >
                    POUR {i + 1}
                  </span>
                  <span className="flex items-center gap-3">
                    <span
                      style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.ink }}
                    >
                      {pourRunningTotals[i] > 0 ? `${pourRunningTotals[i]}g` : ""}
                    </span>
                    {/* Pour 1 has no remove button: a pourover has at least one. */}
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => removePour(i)}
                        aria-label={`Remove pour ${i + 1}`}
                        style={{ color: TOKENS.rule }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4">
                  <div className="grid grid-cols-2 gap-x-2">
                    <Field
                      label="At"
                      value={p.timeMin}
                      onChange={(v) => updatePour(i, "timeMin", v)}
                      mono
                      suffix="min"
                      inputMode="numeric"
                      placeholder="0"
                    />
                    <Field
                      label={" "}
                      value={p.timeSec}
                      onChange={(v) => updatePour(i, "timeSec", v)}
                      mono
                      suffix="sec"
                      inputMode="numeric"
                      placeholder="00"
                    />
                  </div>
                  <Field
                    label="Water"
                    value={p.water}
                    onChange={(v) => updatePour(i, "water", v)}
                    mono
                    suffix="g"
                    inputMode="decimal"
                    placeholder="50"
                  />
                </div>
              </div>
            ))}

            {pours.length < MAX_POURS && (
              <button
                type="button"
                onClick={addPour}
                className="mt-4 text-[10px] uppercase tracking-[0.08em]"
                style={{ fontFamily: MONO, color: TOKENS.green, textDecoration: "underline" }}
              >
                + Add pour
              </button>
            )}
          </div>
        )}

        <Divider />

        {/* 07 Tasting */}
        <StepLabel n={7} title="Tasting Notes" done={flavors.length > 0} />
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
                aria-label={`${i} of 5 cups`}
                className="p-0.5"
                style={{ color: i <= rating ? TOKENS.amber : TOKENS.rule }}
              >
                <Coffee size={18} strokeWidth={i <= rating ? 2.4 : 1.8} />
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
              {saving
                ? "Saving…"
                : saved
                  ? "Saved ✓"
                  : isEditing
                    ? "Save Changes"
                    : "Save Brew"}
            </button>

            {isEditing ? (
              <button
                type="button"
                onClick={onExitEdit}
                disabled={saving}
                className="flex items-center justify-center w-11 rounded-sm shrink-0"
                style={{ border: `1px solid ${TOKENS.rule}`, color: TOKENS.inkFaint }}
                aria-label="Cancel editing"
                title="Cancel"
              >
                <X size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSharing(true)}
                disabled={!lastSaved}
                className="flex items-center justify-center w-11 rounded-sm shrink-0"
                style={{
                  border: `1px solid ${TOKENS.rule}`,
                  color: lastSaved ? TOKENS.ink : TOKENS.rule,
                  cursor: lastSaved ? "pointer" : "default",
                }}
                aria-label="Share the brew you just saved"
                title={
                  lastSaved
                    ? "Share the brew you just saved"
                    : "Save a brew first, then share it"
                }
              >
                <Share2 size={15} />
              </button>
            )}
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

        {sharing && lastSaved && (
          <ShareSheet
            brew={lastSaved.row}
            photoBlob={lastSaved.photoBlob}
            onClose={() => setSharing(false)}
          />
        )}
      </div>
    </div>
  );
}
