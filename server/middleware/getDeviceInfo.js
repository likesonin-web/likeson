import DeviceDetector from "device-detector-js";

const detector = new DeviceDetector();

export const getDeviceInfo = (req, res, next) => {
  const userAgentString = req.headers["user-agent"] || "Unknown";
  const device = detector.parse(userAgentString);

  // ── Platform detection ─────────────────────────────────────────────────────
  let platform = "web";

  const osName = device.os?.name?.toLowerCase() || "";
  const deviceType = device.device?.type?.toLowerCase() || "";
  const clientType = device.client?.type?.toLowerCase() || "";

  if (osName.includes("android")) {
    platform = "android";
  } else if (
    osName.includes("ios") ||
    osName.includes("iphone") ||
    osName.includes("ipad")
  ) {
    platform = "ios";
  } else if (
    osName.includes("windows") ||
    osName.includes("mac") ||
    osName.includes("linux") ||
    osName.includes("ubuntu") ||
    osName.includes("debian") ||
    deviceType === "desktop"
  ) {
    platform = "desktop";
  }
  // else stays "web" (bots, TVs, unknown etc.)

  // ── IP address ─────────────────────────────────────────────────────────────
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "Unknown";

  // ── Device name ────────────────────────────────────────────────────────────
  // Priority: brand + model → os + version → browser name → fallback
  let deviceName = "Unknown Device";

  if (device.device?.brand && device.device?.model) {
    deviceName = `${device.device.brand} ${device.device.model}`;
  } else if (device.os?.name) {
    deviceName = device.os.version
      ? `${device.os.name} ${device.os.version}`
      : device.os.name;
  } else if (device.client?.name) {
    deviceName = device.client.name;
  }

  // ── Attach to request ──────────────────────────────────────────────────────
  req.deviceInfo = {
    userAgent:  userAgentString,
    ipAddress:  ip,
    deviceName,
    platform,                          // 'android' | 'ios' | 'web' | 'desktop'

    // Extra fields available if you want to store them later
    _raw: {
      os:     device.os,               // { name, version, platform, family }
      client: device.client,           // { type, name, version, engine, ... }
      device: device.device,           // { type, brand, model }
      bot:    device.bot,              // non-null if request is from a bot
    },
  };

  next();
};