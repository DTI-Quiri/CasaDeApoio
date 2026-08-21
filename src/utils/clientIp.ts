let cachedIp: string | null = null;

export async function getClientPublicIP(): Promise<string> {
  if (cachedIp) return cachedIp;

  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        cachedIp = String(data.ip).trim();
        return cachedIp;
      }
    }
  } catch {
    // fallback to secondary service
  }

  try {
    const res = await fetch('https://api.seeip.org/json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        cachedIp = String(data.ip).trim();
        return cachedIp;
      }
    }
  } catch {
    // fallback to local fingerprint
  }

  let localFp = localStorage.getItem('app_device_ip_fp');
  if (!localFp) {
    localFp = 'fp-' + crypto.randomUUID().slice(0, 12);
    try {
      localStorage.setItem('app_device_ip_fp', localFp);
    } catch {}
  }
  cachedIp = localFp;
  return cachedIp;
}
