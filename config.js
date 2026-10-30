// ===== ไฟล์ตั้งค่า: ใส่ค่าครั้งเดียว แล้วอัปเดต index.html ทีหลังได้โดยไม่ต้องแก้ไฟล์นี้ =====
window.APP_CONFIG = {
  // Discord Webhook URL ไม่ได้เก็บในไฟล์นี้แล้ว (ย้ายไปเก็บในฐานข้อมูล Supabase แทน เพื่อไม่ให้ใครดู source แล้วเอาไปใช้ได้)

  // 2) ค่าจาก Supabase สำหรับอันดับประจำเดือน (ไม่บังคับ: ถ้าไม่ใช้ ปล่อยไว้ตามเดิม)
  supabaseUrl: "https://kjnnjkhneeagjjcsgxus.supabase.co",
  supabaseKey: "sb_publishable_Ql5mNOskMzsvrCnCay6GLw_8O5RiITq",

  // 3) รายการประเภทของ แก้ไข เพิ่ม ลบ ได้ตามเกมของคุณ
  itemTypes: ["แร่", "กำมะถัน"]
};
