// service-worker.js
// ทำให้เว็บติดตั้งเป็นแอปได้ (installable) และ cache ไฟล์พื้นฐานไว้ใช้ตอนเน็ตหลุดสั้นๆ
// หมายเหตุ: ระบบนี้เป็นระบบที่ข้อมูลเปลี่ยนแปลงบ่อย (งาน, ใบเสนอราคา ฯลฯ)
// จึงตั้งให้ "network-first" คือพยายามโหลดจากอินเทอร์เน็ตก่อนเสมอ
// ถ้าเน็ตหลุดจริงๆ ค่อย fallback ไปใช้ของที่ cache ไว้

const CACHE_NAME = "npt-app-cache-v1";
const OFFLINE_URLS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // ใช้เฉพาะ GET request เท่านั้น (ไม่ cache การ POST เช่น ตอนบันทึกฟอร์ม)
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ================= PUSH NOTIFICATIONS =================
// รับการแจ้งเตือนจริงจากเซิร์ฟเวอร์ แม้ปิดแอปอยู่ก็ตาม
self.addEventListener("push", (event) => {
  let data = { title: "NPT Consultant And Service", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" }
  };

  event.waitUntil(self.registration.showNotification(data.title || "NPT Consultant And Service", options));
});

// กดที่การแจ้งเตือน -> เปิด/โฟกัสแอปที่เปิดอยู่ หรือเปิดหน้าต่างใหม่
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
