import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db, useFirebase } from "./config/firebase";
import { isCloudinaryConfigured, uploadFileToCloudinary, optimizeMediaUrl } from "./config/cloudinary";
import { verifyPassword, setSessionAuthenticated, clearSession, isSessionAuthenticated } from "./config/auth";



// ── Design tokens ──────────────────────────────────────────────
const tokens = {
  bg: "#FFF8F3",
  surface: "#FFFFFF",
  primary: "#E8637A",
  secondary: "#F5C97A",
  pastel: "#E8D5FF",
  text: "#2D1B1B",
  muted: "#9B7B7B",
  success: "#7CD1A1",
};

// ── Sample demo memories ───────────────────────────────────────
const DEMO_MEMORIES = [
  { id: "1", type: "image", caption: "First smile ever 🌸", category: "Milestones", date: "2024-02-14", url: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80" },
  { id: "2", type: "image", caption: "Bath time splashing 💦", category: "Daily Life", date: "2024-03-01", url: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&q=80" },
  { id: "3", type: "image", caption: "First teddy bear hug 🧸", category: "Milestones", date: "2024-03-15", url: "https://images.unsplash.com/photo-1504275107627-0c2ba7a43dba?w=600&q=80" },
  { id: "4", type: "image", caption: "Park stroll with Nani 🌳", category: "Family", date: "2024-04-05", url: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=80" },
  { id: "5", type: "image", caption: "Sleeping like an angel 😴", category: "Daily Life", date: "2024-04-20", url: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&q=80" },
  { id: "6", type: "image", caption: "First birthday cake! 🎂", category: "Milestones", date: "2024-05-10", url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80" },
  { id: "7", type: "image", caption: "Dancing in the living room 💃", category: "Fun Moments", date: "2024-05-22", url: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&q=80" },
  { id: "8", type: "image", caption: "Morning cuddles with Dada 🥰", category: "Family", date: "2024-06-02", url: "https://images.unsplash.com/photo-1602030638412-bb8dcc0bc8b0?w=600&q=80" },
  { id: "9", type: "image", caption: "First steps attempt 👣", category: "Milestones", date: "2024-06-18", url: "https://images.unsplash.com/photo-1566004100631-35d015d6a491?w=600&q=80" },
  { id: "10", type: "image", caption: "Flower garden adventure 🌻", category: "Outings", date: "2024-07-07", url: "https://images.unsplash.com/photo-1487530811015-780f87542782?w=600&q=80" },
  { id: "11", type: "image", caption: "Messy mango lunch 🥭", category: "Daily Life", date: "2024-07-14", url: "https://images.unsplash.com/photo-1519996409144-56c88c4e6def?w=600&q=80" },
  { id: "12", type: "image", caption: "Cousins visit! 🎉", category: "Family", date: "2024-08-01", url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80" },
];

const CATEGORIES = ["All", "Milestones", "Daily Life", "Family", "Fun Moments", "Outings"];
const REAL_CATEGORIES = CATEGORIES.filter(c => c !== "All");

// ── Utility ────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Helper to timeout a promise
function withTimeout(promise, ms, errorMessage = "Operation timed out") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ── Floating petals ────────────────────────────────────────────
function Petals() {
  const petals = ["🌸", "🌺", "🌼", "✨", "💮"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, overflow: "hidden" }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const petal = petals[i % petals.length];
        const left = `${(i * 8.3) % 100}%`;
        const delay = `${(i * 1.7) % 12}s`;
        const dur = `${14 + (i % 5) * 3}s`;
        const size = `${14 + (i % 3) * 6}px`;
        return (
          <span key={i} style={{
            position: "absolute", top: "-30px", left,
            fontSize: size, opacity: 0,
            animation: `petalFall ${dur} ${delay} infinite linear`,
          }}>{petal}</span>
        );
      })}
      <style>{`
        @keyframes petalFall {
          0%   { transform: translateY(-30px) rotate(0deg) translateX(0); opacity: 0; }
          8%   { opacity: 0.6; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(105vh) rotate(380deg) translateX(60px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Blob background ────────────────────────────────────────────
function BlobBg() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {[
        { color: tokens.pastel, top: "-12%", left: "-12%", size: "520px", dur: "20s" },
        { color: "#FFE6E6", bottom: "-12%", right: "-12%", size: "680px", dur: "28s", delay: "-5s" },
        { color: tokens.secondary, top: "40%", left: "68%", size: "420px", dur: "24s", delay: "-10s", opacity: 0.2 },
      ].map((b, i) => (
        <div key={i} style={{
          position: "absolute",
          ...(b.top ? { top: b.top } : {}),
          ...(b.bottom ? { bottom: b.bottom } : {}),
          ...(b.left ? { left: b.left } : {}),
          ...(b.right ? { right: b.right } : {}),
          width: b.size, height: b.size,
          borderRadius: "50%",
          background: b.color,
          filter: "blur(100px)",
          opacity: b.opacity ?? 0.35,
          animation: `floatBlob ${b.dur} ${b.delay ?? "0s"} infinite alternate ease-in-out`,
        }} />
      ))}
      <style>{`
        @keyframes floatBlob {
          0%   { transform: translate(0,0) scale(1) rotate(0deg); }
          100% { transform: translate(48px,48px) scale(1.15) rotate(45deg); }
        }
      `}</style>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ message, visible }) {
  return (
    <div style={{
      position: "fixed", bottom: 32, left: "50%",
      transform: `translateX(-50%) translateY(${visible ? "0" : "80px"})`,
      opacity: visible ? 1 : 0,
      background: tokens.text, color: tokens.bg,
      padding: "13px 28px", borderRadius: 30,
      fontSize: 14, fontWeight: 700,
      boxShadow: "0 20px 40px rgba(45,27,27,.12)",
      zIndex: 9999, pointerEvents: "none",
      transition: "transform .4s cubic-bezier(.175,.885,.32,1.275), opacity .4s ease",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ color: tokens.secondary }}>✨</span> {message}
    </div>
  );
}

// ── Password gate ──────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  async function attempt(e) {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    try {
      const isValid = await verifyPassword(pw);
      if (isValid) {
        onUnlock();
      } else {
        setError("Hmm, try again 🥺");
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    } catch (err) {
      console.error(err);
      setError("Authentication error 🥺");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: tokens.bg,
      zIndex: 999, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: tokens.surface, borderRadius: 24,
        padding: "40px 32px", width: "100%", maxWidth: 440,
        boxShadow: "0 20px 40px rgba(45,27,27,.08)",
        textAlign: "center",
        border: "1px solid rgba(232,99,122,.1)",
        animation: shake ? "shakeLock .5s ease-in-out" : "bloomIn 1s cubic-bezier(.175,.885,.32,1.275)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "heartbeat 2s infinite ease-in-out" }}>🌸</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, color: tokens.text, marginBottom: 8 }}>
          Guggu's Memories
        </h1>
        <p style={{ fontSize: 14, color: tokens.muted, marginBottom: 28, lineHeight: 1.6 }}>
          Welcome to baby Guggu's private journal.<br />Enter the family password to unlock.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(""); }}
            placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && attempt(e)}
            disabled={checking}
            style={{
              width: "100%", padding: "15px 20px",
              borderRadius: 30,
              border: `2px solid ${error ? tokens.primary : "rgba(232,99,122,.15)"}`,
              background: tokens.bg, color: tokens.text,
              fontFamily: "'Nunito',sans-serif", fontSize: 16,
              outline: "none", textAlign: "center", letterSpacing: 4,
              transition: "all .3s",
            }}
            autoFocus
          />
          <button onClick={attempt} disabled={checking} style={{
            background: tokens.primary, color: "#fff",
            border: "none", padding: "15px 32px",
            borderRadius: 30, fontFamily: "'Nunito',sans-serif",
            fontWeight: 700, fontSize: 16, cursor: checking ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all .3s",
            opacity: checking ? 0.7 : 1,
          }}
            onMouseEnter={e => { if (!checking) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(232,99,122,.35)"; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
          >
            {checking ? "Checking..." : "Enter Gallery"}
            {!checking && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>}
          </button>
        </div>
        {error && <p style={{ color: tokens.primary, fontSize: 14, marginTop: 12, fontWeight: 600 }}>{error}</p>}
        <p style={{ fontSize: 12, color: tokens.muted, marginTop: 16 }}>💡 Hint: The default password is "You Already Know" </p>
      </div>
      <style>{`
        @keyframes bloomIn { 0%{transform:scale(.9) translateY(20px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }
        @keyframes shakeLock { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-10px)} 40%,80%{transform:translateX(10px)} }
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
      `}</style>
    </div>
  );
}

// ── Gallery card ───────────────────────────────────────────────
function MemoryCard({ memory, index, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const cardRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { rootMargin: "100px" });

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(index)}
      style={{
        breakInside: "avoid", marginBottom: 24,
        background: tokens.surface, borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(45,27,27,.04)",
        border: "1px solid rgba(45,27,27,.03)",
        cursor: "pointer",
        transition: "transform .4s cubic-bezier(.165,.84,.44,1), box-shadow .4s cubic-bezier(.165,.84,.44,1)",
        animation: `cardAppear .6s ${index * 0.06}s cubic-bezier(.16,1,.3,1) both`,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-8px) scale(1.015)"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(45,27,27,.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 12px rgba(45,27,27,.04)"; }}
    >
      {/* Media */}
      <div style={{ position: "relative", overflow: "hidden", background: "rgba(232,213,255,.1)", borderRadius: "20px 20px 0 0", minHeight: 200 }}>
        {memory.type === "video" && (
          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(45,27,27,.75)", color: "#fff", padding: "4px 8px", borderRadius: 8, fontSize: 10, display: "flex", alignItems: "center", gap: 4, zIndex: 10, fontWeight: 700, letterSpacing: 0.5 }}>
            <span>📹</span> VIDEO
          </div>
        )}
        {!loaded && (
          <div style={{ width: "100%", height: 200, background: "linear-gradient(135deg,#f9e9f0,#f0e9fa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
            🌸
          </div>
        )}
        {inView && (
          memory.type === "video" ? (
            <video
              src={optimizeMediaUrl(memory.url, "video", 600)}
              preload="metadata"
              onLoadedData={() => setLoaded(true)}
              style={{
                width: "100%", display: "block",
                objectFit: "cover",
                opacity: loaded ? 1 : 0,
                transition: "opacity .6s ease",
                maxHeight: 400,
              }}
              muted
              playsInline
            />
          ) : (
            <img
              src={optimizeMediaUrl(memory.url, "image", 600)}
              alt={memory.caption}
              onLoad={() => setLoaded(true)}
              style={{
                width: "100%", display: "block",
                objectFit: "cover",
                opacity: loaded ? 1 : 0,
                transition: "opacity .6s ease",
                maxHeight: 400,
              }}
            />
          )
        )}
      </div>
      {/* Info */}
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: tokens.muted, fontWeight: 600 }}>{formatDate(memory.date)}</span>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: tokens.text, fontWeight: 600, margin: 0 }}>{memory.caption}</p>
      </div>
    </div>
  );
}

// ── Category card ──────────────────────────────────────────────
function CategoryCard({ categoryName, count, coverUrl, isVideo, onClick }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      onClick={onClick}
      style={{
        background: tokens.surface, borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(45,27,27,.04)",
        border: "1px solid rgba(45,27,27,.03)",
        cursor: "pointer",
        transition: "transform .4s cubic-bezier(.165,.84,.44,1), box-shadow .4s cubic-bezier(.165,.84,.44,1)",
        animation: "cardAppear .6s ease both",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-8px) scale(1.015)"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(45,27,27,.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 12px rgba(45,27,27,.04)"; }}
    >
      <div style={{ position: "relative", paddingBottom: "70%", overflow: "hidden", background: "rgba(232,213,255,.1)" }}>
        {coverUrl ? (
          isVideo ? (
            <video
              src={optimizeMediaUrl(coverUrl, "video", 600)}
              preload="metadata"
              onLoadedData={() => setLoaded(true)}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", opacity: loaded ? 1 : 0, transition: "opacity .6s ease"
              }}
              muted
              playsInline
            />
          ) : (
            <img
              src={optimizeMediaUrl(coverUrl, "image", 600)}
              alt={categoryName}
              onLoad={() => setLoaded(true)}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", opacity: loaded ? 1 : 0, transition: "opacity .6s ease"
              }}
            />
          )
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
            🌸
          </div>
        )}
      </div>
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
        <h3 style={{ fontSize: 18, color: tokens.text, margin: 0, fontWeight: 700 }}>{categoryName}</h3>
        <span style={{ fontSize: 13, color: tokens.muted, fontWeight: 600 }}>{count} {count === 1 ? "Memory" : "Memories"}</span>
      </div>
    </div>
  );
}

// ── Lightbox ───────────────────────────────────────────────────
function Lightbox({ memories, index, onClose, onPrev, onNext, onEdit, onDelete }) {
  const memory = memories[index];
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    setImgLoaded(false);
    setIsEditing(false);
    if (memory) {
      setEditCaption(memory.caption);
      setEditCategory(memory.category);
      setEditDate(memory.date);
    }
  }, [index, memory]);

  useEffect(() => {
    function onKey(e) {
      if (isEditing) return;
      if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onPrev, onClose, isEditing]);

  if (!memory) return null;

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this sweet memory? 🥺")) {
      onDelete(memory.id);
      onClose();
    }
  };

  const handleSave = () => {
    if (!editCaption.trim()) return;
    onEdit(memory.id, {
      caption: editCaption,
      category: editCategory,
      date: editDate,
    });
    setIsEditing(false);
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(45,27,27,.97)",
        backdropFilter: "blur(12px)",
        zIndex: 200, display: "flex", flexDirection: "column",
        animation: "fadeIn .3s ease",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", zIndex: 210 }}>
        <button onClick={onClose} style={iconBtnStyle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Edit button */}
          <button onClick={() => setIsEditing(!isEditing)} style={iconBtnStyle} title="Edit Memory">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isEditing ? tokens.secondary : "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          {/* Delete button */}
          <button onClick={handleDelete} style={{ ...iconBtnStyle, color: tokens.primary }} title="Delete Memory">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
          <span style={{ borderLeft: "1px solid rgba(255,255,255,.2)", height: 24, margin: "0 4px" }} />
          <button onClick={onPrev} style={iconBtnStyle} title="Previous">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button onClick={onNext} style={iconBtnStyle} title="Next">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Media */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "0 80px" }}>
        {!imgLoaded && (
          <div style={{ position: "absolute", width: 48, height: 48, border: "3px solid rgba(255,255,255,.1)", borderTopColor: tokens.primary, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        )}
        {memory.type === "video" ? (
          <video
            key={memory.id}
            src={optimizeMediaUrl(memory.url, "video", 1200)}
            controls
            autoPlay
            onLoadedData={() => setImgLoaded(true)}
            style={{
              maxWidth: "100%", maxHeight: "72vh", objectFit: "contain",
              borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,.5)",
              opacity: imgLoaded ? 1 : 0, transition: "opacity .4s ease",
            }}
          />
        ) : (
          <img
            key={memory.id}
            src={optimizeMediaUrl(memory.url, "image", 1200)}
            alt={memory.caption}
            onLoad={() => setImgLoaded(true)}
            style={{
              maxWidth: "100%", maxHeight: "72vh", objectFit: "contain",
              borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,.5)",
              opacity: imgLoaded ? 1 : 0, transition: "opacity .4s ease",
            }}
          />
        )}
        {/* Arrow buttons */}
        <button onClick={onPrev} style={{ ...arrowBtnStyle, left: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <button onClick={onNext} style={{ ...arrowBtnStyle, right: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Footer */}
      <div style={{ padding: "24px 24px 40px", textAlign: "center", color: "#fff", maxWidth: 680, margin: "0 auto", width: "100%" }}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <input
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
              placeholder="Memory Caption..."
              style={lightboxInputStyle}
            />
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                style={{ ...lightboxInputStyle, flex: 1 }}
              >
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                style={{ ...lightboxInputStyle, flex: 1 }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={handleSave} style={saveBtnStyle}>Save Changes</button>
              <button onClick={() => setIsEditing(false)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 10, lineHeight: 1.6 }}>{memory.caption}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ background: tokens.primary, color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, padding: "4px 12px", borderRadius: 12 }}>{memory.category}</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.6)", fontWeight: 600 }}>{formatDate(memory.date)}</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>{index + 1} / {memories.length}</span>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

const lightboxInputStyle = {
  background: "rgba(255,255,255,.12)",
  border: "1px solid rgba(255,255,255,.2)",
  borderRadius: 12,
  color: "#fff",
  padding: "10px 15px",
  fontFamily: "'Nunito',sans-serif",
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const saveBtnStyle = {
  background: tokens.primary,
  color: "#fff",
  border: "none",
  borderRadius: 30,
  padding: "10px 24px",
  fontFamily: "'Nunito',sans-serif",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  boxShadow: "0 4px 12px rgba(232,99,122,.25)",
};

const cancelBtnStyle = {
  background: "rgba(255,255,255,.15)",
  color: "#fff",
  border: "none",
  borderRadius: 30,
  padding: "10px 24px",
  fontFamily: "'Nunito',sans-serif",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

const iconBtnStyle = {
  background: "none", border: "none", cursor: "pointer",
  color: "#fff", opacity: .8, width: 46, height: 46,
  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all .3s",
};

const arrowBtnStyle = {
  position: "absolute", top: "50%", transform: "translateY(-50%)",
  background: "rgba(255,255,255,.07)", border: "none",
  width: 54, height: 54, borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", zIndex: 205, transition: "all .3s",
};

// ── Upload drawer ──────────────────────────────────────────────
function UploadDrawer({ open, onClose, onAdd, showToast }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("Milestones");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef();

  function handleFile(f) {
  if (!f || uploading) return;

  setFile(f);

  const reader = new FileReader();

  reader.onload = (e) => {
    setPreview(e.target.result);
  };

  reader.readAsDataURL(f);
}
  async function submit() {
    if ((!file && !caption) || uploading) return;
    
    setUploading(true);
    setUploadProgress(0);

    try {
     let finalUrl = preview;

if (file) {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured");
  }

  finalUrl = await uploadFileToCloudinary(
  file,
  (progress) => {
    setUploadProgress(progress);
  }
);

  console.log("Uploaded URL:", finalUrl);
}

      const newMemory = {
        id: Date.now().toString(),
        type: file?.type?.startsWith("video")  ? "video" : "image",
        caption: caption || "A sweet memory 🌸",
        category,
        date,
        url: finalUrl || `https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80`,
        createdAt: new Date().toISOString(),
      };

      await onAdd(newMemory);
      onClose();
      // Reset state
      setFile(null); setPreview(null); setCaption(""); setCategory("Milestones");
    } catch (err) {
      console.error(err);
      showToast(`Upload failed: ${err.message || "Unknown error"} 🥺`);
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  const isVideo = file?.type.startsWith("video") || false;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(45,27,27,.4)",
        backdropFilter: "blur(8px)",
        zIndex: 100, display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: 16, animation: "fadeIn .3s ease",
      }}
    >
      <div style={{
        background: tokens.surface, width: "100%", maxWidth: 520,
        maxHeight: "90vh", borderRadius: 24, padding: 32,
        boxShadow: "0 20px 40px rgba(45,27,27,.12)",
        overflowY: "auto", position: "relative",
        animation: "slideUp .4s cubic-bezier(.16,1,.3,1)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: tokens.text }}>Add a Memory ✨</h2>
          <button onClick={onClose} disabled={uploading} style={{ background: "none", border: "none", cursor: uploading ? "not-allowed" : "pointer", color: tokens.muted, padding: 8, borderRadius: "50%", fontSize: 18, display: "flex", opacity: uploading ? 0.5 : 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Drop zone */}
        {!preview ? (
          <div
            onClick={() => !uploading && fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); if (!uploading) setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); if (!uploading) handleFile(e.dataTransfer.files[0]); }}
            style={{
              border: `2px dashed ${drag ? tokens.primary : "rgba(232,99,122,.25)"}`,
              background: drag ? "rgba(232,99,122,.06)" : "rgba(232,99,122,.02)",
              borderRadius: 16, padding: "32px 20px",
              textAlign: "center", cursor: uploading ? "not-allowed" : "pointer",
              transition: "all .3s", marginBottom: 20,
              opacity: uploading ? 0.7 : 1,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>📷</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text, marginBottom: 4 }}>Drop photo or video here</p>
            <p style={{ fontSize: 12, color: tokens.muted }}>or click to browse · JPG, PNG, MP4, MOV</p>
          </div>
        ) : (
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 20, aspectRatio: "16/9", background: "#000" }}>
            {isVideo ? (
              <video src={preview} style={{ width: "100%", height: "100%", objectFit: "contain" }} controls muted />
            ) : (
              <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )}
            <button onClick={() => { if (!uploading) { setFile(null); setPreview(null); } }} disabled={uploading} style={{
              position: "absolute", top: 10, right: 10,
              background: "rgba(0,0,0,.6)", color: "#fff", border: "none",
              width: 32, height: 32, borderRadius: "50%", cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: uploading ? 0.5 : 1,
            }}>✕</button>
          </div>
        )}
        <input type="file" accept="image/*,video/*" ref={fileRef} style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: tokens.text, display: "block", marginBottom: 6 }}>Caption</label>
            <input value={caption} onChange={e => setCaption(e.target.value)} disabled={uploading} placeholder="A sweet little moment..." style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: tokens.text, display: "block", marginBottom: 6 }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} disabled={uploading} style={inputStyle}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: tokens.text, display: "block", marginBottom: 6 }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={uploading} style={inputStyle} />
          </div>

          {/* Progress Indicator */}
          {uploading && (
            <div style={{ marginTop: 4, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: tokens.primary, marginBottom: 6 }}>
                <span>Uploading memory...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ width: "100%", background: "rgba(45,27,27,.05)", borderRadius: 10, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${uploadProgress}%`, background: tokens.primary, height: "100%", transition: "width .1s ease" }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button onClick={onClose} disabled={uploading} style={{
              flex: "0 0 auto", background: "none",
              border: "2px solid rgba(45,27,27,.1)",
              color: tokens.muted, padding: "13px 24px",
              borderRadius: 30, fontFamily: "'Nunito',sans-serif",
              fontWeight: 700, fontSize: 15, cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.5 : 1,
            }}>Cancel</button>
            <button onClick={submit} disabled={uploading} style={{
              flex: 1, background: tokens.primary, color: "#fff",
              border: "none", padding: "13px 24px",
              borderRadius: 30, fontFamily: "'Nunito',sans-serif",
              fontWeight: 700, fontSize: 15, cursor: uploading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 12px rgba(232,99,122,.25)",
              transition: "all .3s",
              opacity: uploading ? 0.7 : 1,
            }}
              onMouseEnter={e => { if (!uploading) e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { if (!uploading) e.currentTarget.style.transform = ""; }}
            >
              {uploading ? "Saving Memory..." : "Save Memory 🌸"}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slideUp { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 15px",
  borderRadius: 12, border: "1px solid rgba(45,27,27,.1)",
  background: tokens.bg, color: tokens.text,
  fontFamily: "'Nunito',sans-serif", fontSize: 14,
  outline: "none", appearance: "none",
};

// ── Main App ───────────────────────────────────────────────────
export default function GuggusWorld() {
  const [unlocked, setUnlocked] = useState(false);
  const [memories, setMemories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "" });

  const showToast = useCallback((msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);

  // Check persistence on initial mount
  useEffect(() => {
    if (isSessionAuthenticated()) {
      setUnlocked(true);
    }
  }, []);

  const handleLogout = () => {
    clearSession();
    setUnlocked(false);
    showToast("Logged out successfully 🚪");
  };

  // Load memories from Firestore or localStorage fallback
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        let data = [];
        if (useFirebase && db) {
          const q = query(collection(db, "memories"), orderBy("createdAt", "desc"));
          const snapshot = await getDocs(q);
          data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // If empty, seed Firestore with DEMO_MEMORIES
          if (data.length === 0) {
            console.log("Firestore collection 'memories' is empty. Seeding DEMO_MEMORIES...");
            try {
              for (let i = 0; i < DEMO_MEMORIES.length; i++) {
                const demo = DEMO_MEMORIES[i];
                const docData = {
                  ...demo,
                  createdAt: new Date(Date.now() - (DEMO_MEMORIES.length - i) * 60000).toISOString()
                };
                // Set 5 seconds timeout for each seed item write
                const docRef = await withTimeout(
                  addDoc(collection(db, "memories"), docData),
                  5000,
                  "Seed write timed out"
                );
                data.push({ id: docRef.id, ...docData });
              }
              data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            } catch (seedErr) {
              console.error("Firestore seeding failed or timed out:", seedErr);
              showToast("Firestore seeding failed/timed out. Falling back to local demo data. 🥺");
              data = DEMO_MEMORIES.map((demo, i) => ({
                ...demo,
                createdAt: new Date(Date.now() - (DEMO_MEMORIES.length - i) * 60000).toISOString()
              }));
            }
          }
        } else {
          const stored = localStorage.getItem("guggu_memories");
          if (stored) {
  data = JSON.parse(stored);

  data = data.filter(
    item => item.url && !item.url.startsWith("blob:")
  );
} else {
            // Seed localStorage with DEMO_MEMORIES
            const seededDemo = DEMO_MEMORIES.map((demo, i) => ({
              ...demo,
              createdAt: new Date(Date.now() - (DEMO_MEMORIES.length - i) * 60000).toISOString()
            }));
            localStorage.setItem("guggu_memories", JSON.stringify(seededDemo));
            data = seededDemo;
          }
        }
        setMemories(data);
      } catch (err) {
        console.error("Error loading memories:", err);
        showToast("Error loading memories 🥺");
        setMemories(DEMO_MEMORIES);
      }
    };

    if (unlocked) {
      loadInitialData();
    }
  }, [unlocked, showToast]);

  // Handle Add Memory
  const handleAddMemory = async (newMemory) => {
    try {
      console.log("🚀 handleAddMemory called");
      console.log("useFirebase =", useFirebase);
      console.log("db =", db);
      console.log("newMemory =", newMemory);

      if (useFirebase && db) {
        console.log("Before Firestore save");

        const docRef = await withTimeout(
          addDoc(collection(db, "memories"), newMemory),
          15000,
          "Firestore save timed out after 15 seconds. Please check your database connection or Firebase configurations."
        );

        console.log("After Firestore save", docRef.id);
        newMemory.id = docRef.id;
      }

      const updated = [newMemory, ...memories];
      setMemories(updated);

      if (!useFirebase) {
        localStorage.setItem(
          "guggu_memories",
          JSON.stringify(updated)
        );
      }

      showToast("Memory saved! 🌸");
    } catch (error) {
      console.error("🔥 FIRESTORE ERROR:", error);
      console.error("Code:", error.code || "N/A");
      console.error("Message:", error.message || "Unknown error");

      showToast(`Failed to save memory: ${error.message || "Unknown error"} 🥺`);
      throw error; // Rethrow to prevent drawer closing and keep user input
    }
  };
  // Handle Edit Memory
  const handleEditMemory = async (id, updatedFields) => {
    try {
      const updated = memories.map(m => m.id === id ? { ...m, ...updatedFields } : m);
      setMemories(updated);

      if (useFirebase && db) {
        await withTimeout(
          updateDoc(doc(db, "memories", id), updatedFields),
          10000,
          "Firestore update timed out after 10 seconds"
        );
      } else {
        localStorage.setItem("guggu_memories", JSON.stringify(updated));
      }
      showToast("Memory updated! 🌸");
    } catch (error) {
      console.error("Error editing memory:", error);
      showToast(`Failed to edit memory: ${error.message || "Unknown error"} 🥺`);
    }
  };

  // Handle Delete Memory
  const handleDeleteMemory = async (id) => {
    try {
      const updated = memories.filter(m => m.id !== id);
      setMemories(updated);

      if (useFirebase && db) {
        await withTimeout(
          deleteDoc(doc(db, "memories", id)),
          10000,
          "Firestore delete timed out after 10 seconds"
        );
      } else {
        localStorage.setItem("guggu_memories", JSON.stringify(updated));
      }
      showToast("Memory deleted 🗑️");
    } catch (error) {
      console.error("Error deleting memory:", error);
      showToast(`Failed to delete memory: ${error.message || "Unknown error"} 🥺`);
    }
  };

  // Sort memories so newly uploaded/createdAt are at the top, then fallback to date
  const sortedMemories = useMemo(() => {
    return [...memories].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA === 0 && timeB === 0) {
        return new Date(b.date) - new Date(a.date);
      }
      return timeB - timeA;
    });
  }, [memories]);

  // Compute category stats: count, latest cover URL, latest type
  const categoryStats = useMemo(() => {
    const stats = {};
    REAL_CATEGORIES.forEach(cat => {
      stats[cat] = {
        name: cat,
        count: 0,
        coverUrl: null,
        isVideo: false,
        latestCreatedAt: 0
      };
    });

    memories.forEach(m => {
      const cat = m.category;
      if (stats[cat]) {
        stats[cat].count += 1;
        const memoryTime = m.createdAt ? new Date(m.createdAt).getTime() : new Date(m.date).getTime();
        if (memoryTime > stats[cat].latestCreatedAt) {
          stats[cat].latestCreatedAt = memoryTime;
          stats[cat].coverUrl = m.url;
          stats[cat].isVideo = m.type === "video";
        }
      }
    });

    // Hide empty categories (only return categories with count > 0)
    return Object.values(stats).filter(cat => cat.count > 0);
  }, [memories]);

  // Stable category order matching CATEGORIES array
  const sortedCategories = useMemo(() => {
    return [...categoryStats].sort((a, b) => {
      return REAL_CATEGORIES.indexOf(a.name) - REAL_CATEGORIES.indexOf(b.name);
    });
  }, [categoryStats]);

  // Filter memories inside the selected category, search-scoped
  const filtered = useMemo(() => {
    if (activeCategory === "All") return [];
    
    return sortedMemories.filter(m => {
      const matchCat = m.category === activeCategory;
      const matchSearch = !search || m.caption.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [sortedMemories, activeCategory, search]);

  const surpriseMe = () => {
    const targetList = activeCategory === "All" ? sortedMemories : filtered;
    if (!targetList.length) return;
    setLightboxIndex(Math.floor(Math.random() * targetList.length));
  };

  // Determine lightbox list based on active view state
  const lightboxMemoriesList = activeCategory === "All" ? sortedMemories : filtered;

  if (!unlocked) return (
    <>
      <BlobBg />
      <Petals />
      <PasswordGate onUnlock={() => { setUnlocked(true); setSessionAuthenticated(); }} />
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: tokens.bg, fontFamily: "'Nunito',sans-serif", color: tokens.text, position: "relative" }}>
      <BlobBg />
      <Petals />

      <div style={{ position: "relative", zIndex: 5 }}>
        {/* Header */}
        <header style={{ padding: "clamp(40px,8vw,80px) 24px 24px", textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
          <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(18px,4vw,26px)", color: tokens.primary, fontStyle: "italic", marginBottom: 8 }}>Welcome to</p>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(36px,8vw,64px)", lineHeight: 1.1, marginBottom: 16, color: tokens.text }}>
            Guggu's <em style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300 }}>World</em> 🌸
          </h1>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(245,201,122,.15)", border: "1px solid rgba(245,201,122,.3)",
            padding: "6px 16px", borderRadius: 20,
            fontSize: 14, fontWeight: 700, color: "#9c6c19", marginBottom: 24,
            animation: "pulseLight 2s infinite",
          }}>
            {memories.length} Memories & Counting 💛
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 8 }}>
            <button onClick={surpriseMe} style={{
              background: tokens.surface, color: tokens.text,
              border: "2px solid rgba(232,99,122,.15)",
              padding: "10px 24px", borderRadius: 30,
              fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 14,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              transition: "all .3s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = tokens.primary; e.currentTarget.style.color = tokens.primary; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "rgba(232,99,122,.15)"; e.currentTarget.style.color = tokens.text; }}
            >
              Surprise Me 🎲
            </button>
            <button onClick={handleLogout} style={{
              background: tokens.surface, color: tokens.primary,
              border: "2px solid rgba(232,99,122,.15)",
              padding: "10px 24px", borderRadius: 30,
              fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 14,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              transition: "all .3s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = tokens.primary; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "rgba(232,99,122,.15)"; }}
            >
              Logout 🚪
            </button>
          </div>
        </header>

        {activeCategory === "All" ? (
          /* HOMEPAGE - Categories Grid View */
          <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 80px" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 24,
            }}>
              {sortedCategories.map(cat => (
                <CategoryCard
                  key={cat.name}
                  categoryName={cat.name}
                  count={cat.count}
                  coverUrl={cat.coverUrl}
                  isVideo={cat.isVideo}
                  onClick={() => { setActiveCategory(cat.name); setSearch(""); }}
                />
              ))}
            </div>
            {sortedCategories.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🌸</div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 8 }}>No categories created yet</h3>
                <p style={{ color: tokens.muted, fontSize: 14 }}>Click the floating button in the bottom right to upload your first memory!</p>
              </div>
            )}
          </main>
        ) : (
          /* SUB-GALLERY PAGE - Images within Selected Category */
          <>
            <section style={{ maxWidth: 1200, margin: "0 auto 32px", padding: "0 24px", textAlign: "center" }}>
              {/* Back Button */}
              <button
                onClick={() => { setActiveCategory("All"); setSearch(""); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: tokens.surface, color: tokens.primary,
                  border: `2px solid rgba(232,99,122,.15)`,
                  padding: "10px 24px", borderRadius: 30,
                  fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 14,
                  cursor: "pointer", transition: "all .3s",
                  boxShadow: "0 4px 12px rgba(45,27,27,.03)",
                  marginBottom: 32,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateX(-4px)"; e.currentTarget.style.borderColor = tokens.primary; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "rgba(232,99,122,.15)"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back to Categories
              </button>

              {/* Sub-header inside category */}
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(28px,6vw,42px)", color: tokens.text, margin: "0 0 8px" }}>
                  {activeCategory}
                </h2>
                <p style={{ fontSize: 14, color: tokens.muted, fontWeight: 600 }}>
                  {filtered.length} {filtered.length === 1 ? "Photo" : "Photos"}
                </p>
              </div>

              {/* Search Bar scoped within category */}
              <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
                <svg style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: tokens.muted, pointerEvents: "none" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search memories in ${activeCategory}...`}
                  style={{ width: "100%", padding: "13px 20px 13px 48px", borderRadius: 30, border: "1px solid rgba(45,27,27,.08)", background: tokens.surface, color: tokens.text, fontFamily: "'Nunito',sans-serif", fontSize: 15, outline: "none", boxShadow: "0 4px 12px rgba(45,27,27,.03)", transition: "all .3s" }}
                />
              </div>
            </section>

            {/* Gallery Grid */}
            <main style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 80px" }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 24px" }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>🥺</div>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 8 }}>No memories found</h3>
                  <p style={{ color: tokens.muted, fontSize: 14 }}>Try a different search query or upload new photos</p>
                </div>
              ) : (
                  <div>        
                  <style>{`
                    @media (min-width: 640px) { .gallery-grid { column-count: 2 !important; } }
                    @media (min-width: 1024px) { .gallery-grid { column-count: 3 !important; } }
                    @media (min-width: 1280px) { .gallery-grid { column-count: 4 !important; } }
                    @keyframes cardAppear { 0%{opacity:0;transform:translateY(30px)} 100%{opacity:1;transform:translateY(0)} }
                    @keyframes pulseLight { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
                    @keyframes addPulse { 0%,100%{box-shadow:0 10px 25px rgba(232,99,122,.4)} 50%{box-shadow:0 10px 35px rgba(232,99,122,.65)} }
                  `}</style>
                  <div className="gallery-grid">
                    {filtered.map((m, i) => (
                      <MemoryCard key={m.id} memory={m} index={i} onClick={setLightboxIndex} />
                    ))}
                  </div>
                </div>
              )}
            </main>
          </>
        )}

        {/* Footer */}
        <footer style={{ textAlign: "center", padding: "48px 24px", color: tokens.muted, fontSize: 14, fontWeight: 600, borderTop: "1px solid rgba(45,27,27,.05)", maxWidth: 1200, margin: "0 auto" }}>
          Made with 💛 for Guggu · Every memory is a treasure 🌸
        </footer>
      </div>

      {/* Floating add button */}
      <button onClick={() => setShowUpload(true)} style={{
        position: "fixed", bottom: 24, right: 24,
        background: tokens.primary, color: "#fff",
        border: "none", width: 60, height: 60, borderRadius: "50%",
        cursor: "pointer", zIndex: 90,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 10px 25px rgba(232,99,122,.4)",
        animation: "addPulse 2s infinite",
        transition: "all .3s",
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
        title="Add Memory"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          memories={lightboxMemoriesList}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i - 1 + lightboxMemoriesList.length) % lightboxMemoriesList.length)}
          onNext={() => setLightboxIndex(i => (i + 1) % lightboxMemoriesList.length)}
          onEdit={handleEditMemory}
          onDelete={handleDeleteMemory}
        />
      )}

      {/* Upload drawer */}
      <UploadDrawer
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onAdd={handleAddMemory}
        showToast={showToast}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}

