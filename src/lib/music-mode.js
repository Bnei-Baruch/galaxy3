// "Music mode" for live music sent to the room. Persisted in localStorage.gxyMusic:
//   "speech"       (default) original behaviour: speech-tuned capture, mono Opus ~32 kbps
//   "music"        no echo cancellation / noise suppression / auto gain, stereo Opus up to 256 kbps
//   "speech-noaec" (dev only) original capture, but echo cancellation off (loopback sources)
export const getMusicMode = () => {
  try {
    return localStorage.getItem("gxyMusic") || "speech";
  } catch (e) {
    return "speech";
  }
};

export const isMusic = () => getMusicMode() === "music";

export const setMusicEnabled = (enabled) => {
  try {
    localStorage.setItem("gxyMusic", enabled ? "music" : "speech");
  } catch (e) {
    // storage unavailable, keep the default
  }
};

// Dev only: set localStorage.gxyStats = "1" to log one compact audio stats line every 5s
// ("[gxy-stats]" in the console), for sender and receiver connections.
export const startAudioStats = (pc, label) => {
  try {
    if (localStorage.getItem("gxyStats") !== "1") return;
  } catch (e) {
    return;
  }
  if (!pc || pc.__gxyStats) return;
  pc.__gxyStats = true;
  let prev = null;
  const timer = setInterval(async () => {
    if (!pc || pc.connectionState === "closed") {
      clearInterval(timer);
      return;
    }
    try {
      const report = await pc.getStats();
      const all = [];
      report.forEach((s) => all.push(s));
      const byId = (id) => all.find((s) => s.id === id);
      const rtp = all.find((s) => (s.type === "outbound-rtp" || s.type === "inbound-rtp") && (s.kind || s.mediaType) === "audio");
      if (!rtp) return;
      const now = rtp.timestamp;
      const bytes = rtp.type === "outbound-rtp" ? rtp.bytesSent : rtp.bytesReceived;
      const kbps = prev ? Math.round(((bytes - prev.bytes) * 8) / (now - prev.now)) : null;
      prev = {bytes, now};
      const codec = byId(rtp.codecId);
      const src = rtp.mediaSourceId ? byId(rtp.mediaSourceId) : null;
      const out = {
        label,
        dir: rtp.type === "outbound-rtp" ? "send" : "recv",
        kbps,
        fmtp: codec && codec.sdpFmtpLine,
        target: rtp.targetBitrate,
        audioLevel: src ? src.audioLevel : rtp.audioLevel,
        aec: src ? (src.echoReturnLoss !== undefined) : undefined,
        lost: rtp.packetsLost,
        concealed: rtp.concealedSamples,
        jitter: rtp.jitter,
      };
      console.log("[gxy-stats] " + JSON.stringify(out));
    } catch (e) {
      // ignore
    }
  }, 5000);
};
