/* Service worker: notifiche push per lo staff Stickerprint */
self.addEventListener('push', (event) => {
	let data = { title: 'Stickerprint', body: 'Nuovo ordine', url: '/dashboard/fatturazione/ordini' };
	try { data = { ...data, ...event.data.json() }; } catch { /* payload non JSON */ }
	event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: data.tag || 'ordine', data: { url: data.url }, vibrate: [120, 60, 120] }));
});
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url || '/dashboard';
	event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
		for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
		return self.clients.openWindow(url);
	}));
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
