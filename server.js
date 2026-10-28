// เซิร์ฟเวอร์คั่นกลาง: เก็บ Webhook URL ไว้ฝั่งเซิร์ฟเวอร์ ไม่ส่งให้หน้าเว็บ
// ต้องใช้ Node.js 18 ขึ้นไป ไม่ต้องติดตั้งแพ็กเกจเพิ่ม
const http = require("http");
const fs = require("fs");
const path = require("path");

// โหลด .env แบบง่ายๆ (ถ้ามี)
try {
  fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  });
} catch (e) {}

const PORT = process.env.PORT || 3000;
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
if (!WEBHOOK || !WEBHOOK.startsWith("https://discord.com/api/webhooks/")) {
  console.error("ยังไม่ได้ตั้งค่า DISCORD_WEBHOOK_URL ในไฟล์ .env");
  process.exit(1);
}

// รายการประเภทของ แก้ไขได้ตามเกมของคุณ
const ITEM_TYPES = ["วัตถุดิบ", "แร่", "ยา/ไอเทมฟื้นฟู", "อาวุธ/อุปกรณ์", "เงิน/เหรียญ", "อื่นๆ"];

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_BODY = 12 * 1024 * 1024;
const DB_FILE = path.join(__dirname, "sent.json");

// ----- กันส่งซ้ำ: 1 ชื่อในเกมต่อ 1 วัน (ตามเวลาไทย) เก็บในไฟล์ sent.json -----
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
let sent = {};
try { sent = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (e) {}
const saveSent = () => {
  const d = today();
  for (const k of Object.keys(sent)) if (!k.startsWith(d + ":")) delete sent[k];
  try { fs.writeFileSync(DB_FILE, JSON.stringify(sent)); } catch (e) { console.error("บันทึก sent.json ไม่ได้", e.message); }
};

// ----- จำกัดความถี่ต่อ IP: 10 ครั้งต่อนาที -----
const hits = new Map();
const limited = ip => {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 10;
};
setInterval(() => hits.clear(), 10 * 60000).unref();

const json = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};

const readBody = req => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on("data", c => {
    size += c.length;
    if (size > MAX_BODY) { reject(new Error("TOO_BIG")); req.destroy(); return; }
    chunks.push(c);
  });
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

async function submit(req, res) {
  const ip = (TRUST_PROXY && (req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress;
  if (limited(ip)) return json(res, 429, { error: "ส่งถี่เกินไป รอสักครู่แล้วลองใหม่" });

  let b;
  try { b = JSON.parse(await readBody(req)); }
  catch (e) { return json(res, e.message === "TOO_BIG" ? 413 : 400, { error: e.message === "TOO_BIG" ? "ไฟล์ใหญ่เกินไป" : "ข้อมูลไม่ถูกต้อง" }); }

  const dc = String(b.dc || "").trim().slice(0, 64);
  const ign = String(b.ign || "").trim().slice(0, 64);
  const type = String(b.type || "");
  const qty = Number.parseInt(b.qty, 10);
  const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));

  if (!dc || !ign) return json(res, 400, { error: "กรุณากรอกชื่อ Discord และชื่อในเกม" });
  if (!ITEM_TYPES.includes(type)) return json(res, 400, { error: "ประเภทของไม่ถูกต้อง" });
  if (!(qty >= 1 && qty <= 99999)) return json(res, 400, { error: "จำนวนชิ้นต้องอยู่ระหว่าง 1 ถึง 99,999" });
  if (!m) return json(res, 400, { error: "ไฟล์รูปต้องเป็น PNG, JPG, WEBP หรือ GIF" });

  const img = Buffer.from(m[2], "base64");
  if (img.length > MAX_IMAGE) return json(res, 413, { error: "รูปใหญ่เกิน 8 MB" });

  const key = today() + ":" + ign.toLowerCase();
  if (sent[key]) return json(res, 409, { error: "วันนี้ส่งของในชื่อ “" + ign + "” ไปแล้ว พรุ่งนี้ส่งได้ใหม่" });
  sent[key] = 1; // จองสิทธิ์ก่อน กันกดส่งซ้อนกัน

  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const payload = {
    username: "ส่งของรายวัน",
    allowed_mentions: { parse: [] },
    embeds: [{
      title: "📦 ส่งของรายวัน",
      color: 0x1f7a5c,
      fields: [
        { name: "ชื่อ Discord", value: dc, inline: true },
        { name: "ชื่อในเกม", value: ign, inline: true },
        { name: "ประเภทของ", value: type, inline: true },
        { name: "จำนวน", value: qty.toLocaleString("th-TH") + " ชิ้น", inline: true },
        { name: "เวลา", value: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) }
      ],
      image: { url: "attachment://photo." + ext }
    }]
  };
  const fd = new FormData();
  fd.append("payload_json", JSON.stringify(payload));
  fd.append("files[0]", new Blob([img], { type: "image/" + m[1] }), "photo." + ext);

  try {
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(WEBHOOK, { method: "POST", body: fd });
      if (r.status !== 429) break;
      // Discord จำกัดความถี่ชั่วคราว: รอตามที่ Discord บอกแล้วลองใหม่ (ไม่เกิน 8 วินาทีต่อครั้ง)
      let wait = 2;
      try { wait = Number(r.headers.get("retry-after")) || (await r.clone().json()).retry_after || 2; } catch (e) {}
      console.error("Discord 429 รอ " + wait + " วินาที (ครั้งที่ " + (attempt + 1) + ")");
      if (wait > 10) { // ถูกบล็อกยาว ไม่ต้องลองซ้ำ ลองซ้ำมีแต่จะยิ่งโดนนาน
        delete sent[key];
        return json(res, 503, { error: "Discord บล็อกการส่งชั่วคราว ลองใหม่อีกครั้งในอีก " + Math.ceil(wait / 60) + " นาที" });
      }
      if (attempt < 2) await new Promise(ok => setTimeout(ok, wait * 1000));
    }
    if (!r.ok) {
      let body = ""; try { body = (await r.text()).slice(0, 200); } catch (e) {}
      console.error("Discord ตอบกลับ", r.status, body);
      throw new Error("Discord " + r.status);
    }
    saveSent();
    json(res, 200, { ok: true });
  } catch (e) {
    delete sent[key]; // ส่งไม่สำเร็จ ให้ลองใหม่ได้
    console.error("ส่งเข้า Discord ไม่สำเร็จ:", e.message);
    json(res, 502, { error: "ส่งเข้า Discord ไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
}

// หาไฟล์ index.html ใน public/ ก่อน ถ้าไม่มีให้ใช้ไฟล์ที่วางไว้ข้างๆ server.js
const INDEX = [path.join(__dirname, "public", "index.html"), path.join(__dirname, "index.html")]
  .find(p => fs.existsSync(p)) || path.join(__dirname, "public", "index.html");

http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (req.method === "GET" && url === "/api/config") return json(res, 200, { itemTypes: ITEM_TYPES });
  if (req.method === "POST" && url === "/api/submit") return submit(req, res);
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return fs.createReadStream(INDEX).pipe(res);
  }
  json(res, 404, { error: "ไม่พบหน้านี้" });
}).listen(PORT, () => console.log("เปิดที่ http://localhost:" + PORT));
