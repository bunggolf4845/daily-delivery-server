// ===== ไฟล์ตั้งค่า: ใส่ค่าครั้งเดียว แล้วอัปเดต index.html ทีหลังได้โดยไม่ต้องแก้ไฟล์นี้ =====
window.APP_CONFIG = {
  // 1) Discord Webhook URL (จำเป็น)
  webhookUrl: "PASTE_YOUR_DISCORD_WEBHOOK_URL_HERE",

  // 2) ค่าจาก Supabase สำหรับอันดับประจำเดือน (ไม่บังคับ: ถ้าไม่ใช้ ปล่อยไว้ตามเดิม)
  supabaseUrl: "PASTE_YOUR_SUPABASE_URL_HERE",
  supabaseKey: "PASTE_YOUR_SUPABASE_KEY_HERE",

  // 3) รายการประเภทของ แก้ไข เพิ่ม ลบ ได้ตามเกมของคุณ
  itemTypes: ["วัตถุดิบ", "แร่", "ยา/ไอเทมฟื้นฟู", "อาวุธ/อุปกรณ์", "เงิน/เหรียญ", "อื่นๆ"]
};
