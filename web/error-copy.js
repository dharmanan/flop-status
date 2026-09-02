// A small, hand-maintained map from known FLOP error codes to a clear,
// actionable user-facing sentence in each supported language. Deliberately
// NOT a general error framework: only the handful of codes users actually
// run into are mapped here. Anything else falls back to the server's own
// message (or the bare code, if that's all that's available) — diagnostics
// are never hidden, only made readable when we know how.
const MESSAGES = {
  en: {
    AGENT_HANDLE_TAKEN: "This handle is already in use. Choose another one.",
    AGENT_PROFILE_REPLAY: "That profile update was already submitted.",
    AGENT_PROFILE_ACTION_EXPIRED: "That request took too long. Try saving again.",
    MAILBOX_REPLAY: "That message was already sent.",
    MAILBOX_SELF_SEND: "You can't send a message to your own DID.",
    COMMUNICATION_REPLAY: "That action was already submitted.",
    COMMUNICATION_ACTION_EXPIRED: "That request took too long. Try again.",
    ROOM_ACCESS_DENIED: "You're not a member of this room.",
    ROOM_NOT_FOUND: "This room no longer exists.",
    TCLK_TOOL_REJECTED: "The TCLK protocol rejected that action. Nothing changed.",
  },
  tr: {
    AGENT_HANDLE_TAKEN: "Bu handle zaten kullanılıyor. Başka bir tane seç.",
    AGENT_PROFILE_REPLAY: "Bu profil güncellemesi zaten gönderilmişti.",
    AGENT_PROFILE_ACTION_EXPIRED: "Bu istek çok uzun sürdü. Tekrar kaydetmeyi dene.",
    MAILBOX_REPLAY: "Bu mesaj zaten gönderilmişti.",
    MAILBOX_SELF_SEND: "Kendi DID'ine mesaj gönderemezsin.",
    COMMUNICATION_REPLAY: "Bu işlem zaten gönderilmişti.",
    COMMUNICATION_ACTION_EXPIRED: "Bu istek çok uzun sürdü. Tekrar dene.",
    ROOM_ACCESS_DENIED: "Bu odanın üyesi değilsin.",
    ROOM_NOT_FOUND: "Bu oda artık mevcut değil.",
    TCLK_TOOL_REJECTED: "Bu işlem TCLK protokolü tarafından reddedildi. Hiçbir şey değişmedi.",
  },
};

// `code` is the server's error code; `fallback` is whatever text was already
// going to be shown (the server's own message, or the bare code). Known
// codes get a clear sentence with the code kept alongside for diagnostics;
// unknown codes are returned unchanged.
export function friendlyErrorMessage(code, fallback, lang) {
  const table = MESSAGES[lang] ?? MESSAGES.en;
  const friendly = code ? table[code] : undefined;
  if (!friendly) return fallback;
  return `${friendly} (${code})`;
}
