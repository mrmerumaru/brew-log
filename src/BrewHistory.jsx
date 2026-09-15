import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Coffee, Loader2, Pencil, RefreshCw, Share2, Trash2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { TOKENS, SANS, MONO, SERIF, PHOTO_BUCKET } from "./tokens";
import {
  formatBrewTime,
  ratioOf,
  daysOffRoast,
  milkLabel,
  grindLabel,
  beansLabel,
  poursLabel,
} from "./brew";
import ShareSheet from "./ShareSheet";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — plenty for a browsing session

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function FilterBar({ brews, method, setMethod, query, setQuery, minRating, setMinRating, onClear, active }) {
  // Only offer methods that actually appear in your history — a filter that
  // can only ever return nothing isn't worth showing.
  const methods = useMemo(
    () => [...new Set(brews.map((b) => b.method).filter(Boolean))],
    [brews],
  );

  return (
    <div
      className="mb-4 pb-4"
      style={{ borderBottom: `1px dashed ${TOKENS.rule}` }}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search beans, origin, roaster…"
        className="w-full bg-transparent outline-none pb-1.5 text-[14px] mb-3"
        style={{
          fontFamily: SERIF,
          color: TOKENS.ink,
          borderBottom: `1px solid ${TOKENS.rule}`,
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {methods.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(method === m ? null : m)}
            className="px-2.5 py-1 rounded-full text-[12px]"
            style={{
              fontFamily: SERIF,
              border: `1px solid ${method === m ? TOKENS.green : TOKENS.rule}`,
              background: method === m ? TOKENS.greenSoft : "transparent",
              color: method === m ? TOKENS.green : TOKENS.inkFaint,
            }}
          >
            {m}
          </button>
        ))}

        <span className="flex items-center gap-1 ml-auto">
          <span
            className="mr-1"
            style={{ fontFamily: MONO, fontSize: 9, color: TOKENS.inkFaint, letterSpacing: "0.1em" }}
          >
            MIN
          </span>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              // Tapping the active threshold clears it, so there's always a way
              // back to "any rating" without hunting for the reset.
              onClick={() => setMinRating(minRating === i ? 0 : i)}
              aria-label={`At least ${i} cups`}
              className="p-0.5"
              style={{ color: i <= minRating ? TOKENS.amber : TOKENS.rule }}
            >
              <Coffee size={14} strokeWidth={i <= minRating ? 2.4 : 1.8} />
            </button>
          ))}
        </span>
      </div>

      {active && (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-[10px] uppercase tracking-[0.08em]"
          style={{ fontFamily: MONO, color: TOKENS.inkFaint, textDecoration: "underline" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Meta({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div
        style={{ fontFamily: MONO, fontSize: 9, color: TOKENS.inkFaint, letterSpacing: "0.1em" }}
      >
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: TOKENS.ink }}>{value}</div>
    </div>
  );
}

function BrewCard({ brew, photoUrl, onEdit, onDelete, onShare, deleting, sharing }) {
  const ratio = ratioOf(brew);
  const brewTime = formatBrewTime(brew.brew_time_s);
  // Relative to when this brew was made, not today — see daysOffRoast.
  const rest = daysOffRoast(brew.roast_date, brew.created_at);
  const milk = milkLabel(brew);
  const grind = grindLabel(brew);
  const pours = poursLabel(brew);
  // Deleting is irreversible, so the trash icon arms a confirm rather than
  // firing straight away.
  const [confirming, setConfirming] = useState(false);

  return (
    <li
      className="rounded-sm overflow-hidden"
      style={{
        background: TOKENS.card,
        border: `1px solid ${TOKENS.rule}`,
        boxShadow: "0 1px 2px rgba(32,29,26,0.04)",
      }}
    >
      <div className="flex gap-4 p-4">
        <div
          className="shrink-0 rounded-sm overflow-hidden flex items-center justify-center"
          style={{
            width: 72,
            height: 72,
            background: TOKENS.paper,
            border: `1px solid ${TOKENS.rule}`,
          }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Coffee size={18} style={{ color: TOKENS.rule }} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className="text-[14px] truncate"
              style={{ fontFamily: SANS, fontWeight: 700, color: TOKENS.ink }}
            >
              {brew.drink || brew.method || "Brew"}
            </h3>
            <span
              className="shrink-0 flex items-center gap-0.5"
              aria-label={`${brew.rating ?? 0} of 5 cups`}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Coffee
                  key={i}
                  size={13}
                  strokeWidth={i <= (brew.rating ?? 0) ? 2.4 : 1.8}
                  style={{ color: i <= (brew.rating ?? 0) ? TOKENS.amber : TOKENS.rule }}
                />
              ))}
            </span>
          </div>

          <p
            className="text-[13px] mt-0.5 truncate"
            style={{ fontFamily: SERIF, color: TOKENS.inkFaint }}
          >
            {/* Method moves here once a drink is named, so it isn't lost. */}
            {[brew.drink ? brew.method : null, beansLabel(brew)]
              .filter(Boolean)
              .join(" · ") || "No bean recorded"}
          </p>

          {/* Grouped with the beans line — both describe what went in the cup. */}
          {milk && (
            <p
              className="text-[12px] mt-1 truncate"
              style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
            >
              {milk}
            </p>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
            <Meta label="RATIO" value={ratio} />
            <Meta label="DOSE" value={brew.dose_g ? `${brew.dose_g}g` : null} />
            <Meta label="TEMP" value={brew.water_temp_c ? `${brew.water_temp_c}°C` : null} />
            <Meta label="TIME" value={brewTime} />
            <Meta label="BEANS" value={brew.bean_type} />
            <Meta label="GRIND" value={grind} />
            <Meta label="OFF ROAST" value={rest == null ? null : `${rest}d`} />
          </div>

          {/* The pour schedule is the whole point of recording it — a pourover
              can't be reproduced from the totals alone. */}
          {pours && (
            <p className="text-[12px] mt-2" style={{ fontFamily: MONO, color: TOKENS.inkFaint }}>
              <span style={{ letterSpacing: "0.1em", fontSize: 9 }}>POURS </span>
              {pours}
            </p>
          )}

          {brew.flavor_tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {brew.flavor_tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[11px]"
                  style={{
                    fontFamily: SERIF,
                    background: TOKENS.greenSoft,
                    color: TOKENS.green,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {brew.notes && (
            <p
              className="text-[13px] mt-3"
              style={{ fontFamily: SERIF, fontStyle: "italic", color: TOKENS.ink }}
            >
              {brew.notes}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: TOKENS.inkFaint,
                letterSpacing: "0.08em",
              }}
            >
              {formatDate(brew.created_at)}
            </span>

            {deleting ? (
              <span
                className="flex items-center gap-1.5"
                style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.inkFaint }}
              >
                <Loader2 size={11} className="animate-spin" />
                Deleting…
              </span>
            ) : confirming ? (
              <span className="flex items-center gap-3">
                <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.inkFaint }}>
                  Delete?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-[10px] uppercase tracking-[0.08em]"
                  style={{ fontFamily: MONO, color: TOKENS.inkFaint }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(brew)}
                  className="text-[10px] uppercase tracking-[0.08em]"
                  style={{ fontFamily: MONO, fontWeight: 600, color: TOKENS.red }}
                >
                  Delete
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onShare(brew)}
                  disabled={sharing}
                  aria-label={`Share this ${brew.drink || brew.method || "brew"}`}
                  title="Share brew"
                  style={{ color: TOKENS.inkFaint }}
                >
                  {sharing ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Share2 size={13} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(brew, photoUrl)}
                  aria-label={`Edit this ${brew.drink || brew.method || "brew"}`}
                  title="Edit brew"
                  style={{ color: TOKENS.inkFaint }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  aria-label={`Delete this ${brew.drink || brew.method || "brew"}`}
                  title="Delete brew"
                  style={{ color: TOKENS.rule }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function BrewHistory({ refreshKey, onEdit }) {
  const [brews, setBrews] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // fetch failure — replaces the list
  const [deletingId, setDeletingId] = useState(null);
  const [sharingId, setSharingId] = useState(null);
  const [shareTarget, setShareTarget] = useState(null); // { brew, photoBlob }

  const [method, setMethod] = useState(null);
  const [query, setQuery] = useState("");
  const [minRating, setMinRating] = useState(0);

  const filtersActive = Boolean(method) || query.trim() !== "" || minRating > 0;

  const clearFilters = () => {
    setMethod(null);
    setQuery("");
    setMinRating(0);
  };

  // Filtering happens client-side over the rows already fetched. At this scale
  // that's instant and avoids a round trip per keystroke; if history ever grows
  // into the thousands this is the thing to move server-side.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brews.filter((b) => {
      if (method && b.method !== method) return false;
      if (minRating > 0 && (b.rating ?? 0) < minRating) return false;
      if (q) {
        const haystack = [
          b.drink,
          // beansLabel covers names, origins and percentages for a blend as
          // well as a single origin; component processes need adding by hand.
          beansLabel(b),
          ...(Array.isArray(b.blend_components) ? b.blend_components : []).map((c) => c?.process),
          b.notes,
          b.process,
          b.roast_level,
          b.milk_brand,
          b.milk_type,
          b.bean_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [brews, method, query, minRating]);
  // Kept separate from `error`: a failed delete should appear beneath the list,
  // not replace it, since everything else on screen is still valid.
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("brews")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    setBrews(rows);

    // The brew-photos bucket is private, so a plain public URL 400s. Every
    // thumbnail needs a short-lived signed URL; createSignedUrls does the whole
    // page in one request instead of one per row.
    const paths = rows.map((b) => b.photo_path).filter(Boolean);
    if (paths.length > 0) {
      const { data: signed, error: signError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

      if (!signError && signed) {
        const map = {};
        signed.forEach((entry) => {
          if (entry.signedUrl && !entry.error) map[entry.path] = entry.signedUrl;
        });
        setPhotoUrls(map);
      }
      // A signing failure just means no thumbnails — the brew data still shows.
    } else {
      setPhotoUrls({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Fetch the photo, then hand off to ShareSheet for aspect choice and preview.
  const handleShare = useCallback(async (brew) => {
    setSharingId(brew.id);
    setDeleteError(null);

    try {
      // Download through the SDK rather than pointing an <img> at the signed
      // URL: a Blob can't taint the canvas, so toBlob() is guaranteed to work.
      let photoBlob = null;
      if (brew.photo_path) {
        const { data, error: downloadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .download(brew.photo_path);
        if (!downloadError) photoBlob = data;
        // A missing photo just means a text-only card, not a failed share.
      }
      setShareTarget({ brew, photoBlob });
    } catch (err) {
      setDeleteError(`Couldn't prepare the share card: ${err?.message ?? err}`);
    } finally {
      setSharingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (brew) => {
    setDeletingId(brew.id);
    setDeleteError(null);

    // Delete the row first: it's the source of truth, and RLS guarantees you
    // can only remove your own. Doing the file first risks leaving a card with
    // a broken thumbnail if the row delete then fails.
    const { error: deleteError } = await supabase.from("brews").delete().eq("id", brew.id);

    if (deleteError) {
      setDeleteError(`Couldn't delete that brew: ${deleteError.message}`);
      setDeletingId(null);
      return;
    }

    setBrews((prev) => prev.filter((b) => b.id !== brew.id));

    // Best-effort photo cleanup. The entry is already gone, which is what was
    // asked for — a leftover file is a storage-quota nuisance, not a broken
    // state, so warn rather than treating it as a failed delete.
    if (brew.photo_path) {
      const { error: storageError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([brew.photo_path]);

      if (storageError) {
        setDeleteError(
          `Brew deleted, but its photo is still in storage (${storageError.message}). ` +
            `If this keeps happening, run supabase/002-photo-delete-policy.sql.`,
        );
      }
    }

    setDeletingId(null);
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-16"
        style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.inkFaint }}
      >
        <Loader2 size={14} className="animate-spin" />
        Loading brews…
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-16 text-center text-[13px]" style={{ fontFamily: SERIF, color: TOKENS.red }}>
        {error}
      </p>
    );
  }

  if (brews.length === 0) {
    return (
      <div className="py-16 text-center">
        <Coffee size={22} style={{ color: TOKENS.rule }} className="mx-auto mb-3" />
        <p style={{ fontFamily: SERIF, fontSize: 14, color: TOKENS.inkFaint }}>
          No brews yet. Log one and it'll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px]">
      {/* One brew can't be filtered into anything useful — don't add the chrome. */}
      {brews.length > 1 && (
        <FilterBar
          brews={brews}
          method={method}
          setMethod={setMethod}
          query={query}
          setQuery={setQuery}
          minRating={minRating}
          setMinRating={setMinRating}
          onClear={clearFilters}
          active={filtersActive}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[10px] uppercase"
          style={{ fontFamily: MONO, color: TOKENS.inkFaint, letterSpacing: "0.1em" }}
        >
          {filtersActive
            ? `${visible.length} of ${brews.length} brews`
            : `${brews.length} ${brews.length === 1 ? "brew" : "brews"}`}
        </span>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-[10px] uppercase"
          style={{ fontFamily: MONO, color: TOKENS.inkFaint, letterSpacing: "0.1em" }}
        >
          <RefreshCw size={11} />
          Refresh
        </button>
      </div>

      {visible.length === 0 ? (
        <p
          className="py-10 text-center text-[14px]"
          style={{ fontFamily: SERIF, color: TOKENS.inkFaint }}
        >
          No brews match those filters.
        </p>
      ) : (
      <ul className="flex flex-col gap-3">
        {visible.map((brew) => (
          <BrewCard
            key={brew.id}
            brew={brew}
            photoUrl={photoUrls[brew.photo_path]}
            onEdit={onEdit}
            onDelete={handleDelete}
            onShare={handleShare}
            deleting={deletingId === brew.id}
            sharing={sharingId === brew.id}
          />
        ))}
      </ul>
      )}

      {deleteError && (
        <p
          className="mt-4 text-[13px]"
          style={{ fontFamily: SERIF, color: TOKENS.red }}
          role="alert"
        >
          {deleteError}
        </p>
      )}

      {shareTarget && (
        <ShareSheet
          brew={shareTarget.brew}
          photoBlob={shareTarget.photoBlob}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
