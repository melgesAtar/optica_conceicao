(function(){
	'use strict';

	// Configurações
	const PIXEL_ID = '1379622556865416';
	const ACCESS_TOKEN = 'EAAL0LdBY2jQBP8x2GQy57RJbcn6PJZBiGEz82KyT4ZB0AMrcdslUvaPhI5aNA0IcZCTYEpuqfP92ERELYDNMvR1E8vDarNnluO1VqZCe4ssQrDPZAxkPmKlsCZCPV0Qc2sJcdvZBAESqCDQ22Eij5B66NLAIHxxvAmTA4fOIjed5kAEvwkhiRE1ZBZAxXLJMKSgZDZD';
	const GRAPH_URL = 'https://graph.facebook.com/v20.0/' + PIXEL_ID + '/events?access_token=' + encodeURIComponent(ACCESS_TOKEN);

	// Utilitários
	function uuid(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
			const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}

	function readCookie(name){
		const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
		return match ? decodeURIComponent(match[2]) : '';
	}

	function ensureFbc(){
		try {
			const url = new URL(window.location.href);
			const fbclid = url.searchParams.get('fbclid');
			let fbc = readCookie('_fbc');
			if(!fbc && fbclid){
				fbc = 'fb.1.' + Date.now() + '.' + fbclid;
				document.cookie = '_fbc=' + encodeURIComponent(fbc) + '; path=/; SameSite=Lax';
			}
			return fbc || '';
		} catch(e){
			return '';
		}
	}

	function getFbp(){
		return readCookie('_fbp') || '';
	}

	function getOrCreateClientId(){
		try {
			const key = 'oc_client_id';
			let id = localStorage.getItem(key);
			if(!id){
				id = (crypto.randomUUID ? crypto.randomUUID() : uuid());
				localStorage.setItem(key, id);
			}
			return id;
		} catch(e){
			return uuid();
		}
	}

	async function sha256Hex(text){
		const data = new TextEncoder().encode(String(text).trim().toLowerCase());
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
	}

	let cachedIp = '';
	async function getClientIp(){
		if(cachedIp) return cachedIp;
		try {
			// Serviço simples e gratuito para obter IP público
			const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
			if(r.ok){
				const j = await r.json();
				cachedIp = j.ip || '';
				return cachedIp;
			}
		} catch(e){}
		try {
			// Fallback (Cloudflare trace)
			const r2 = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store' });
			const t = await r2.text();
			const m = t.match(/ip=([^\n]+)/);
			cachedIp = m ? m[1] : '';
			return cachedIp;
		} catch(e){}
		return '';
	}

	async function sendCapi(eventName, eventId, customData){
		try {
			const [externalId, clientIp] = await Promise.all([
				sha256Hex(getOrCreateClientId()),
				getClientIp()
			]);

			const userData = {
				external_id: externalId,
				client_user_agent: navigator.userAgent || '',
				client_ip_address: clientIp || undefined,
				fbp: getFbp() || undefined,
				fbc: ensureFbc() || undefined
			};

			const payload = {
				data: [{
					event_name: eventName,
					event_time: Math.floor(Date.now() / 1000),
					event_id: eventId,
					action_source: 'website',
					event_source_url: location.href,
					user_data: userData,
					custom_data: customData || {}
				}],
				partner_agent: 'optica_conceicao-web'
			};

			await fetch(GRAPH_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				mode: 'cors',
				keepalive: true
			});
		} catch(e){
			// silencioso
		}
	}

	function track(eventName, customData){
		const eventId = uuid();
		if(window.fbq){
			window.fbq('track', eventName, customData || {}, { eventID: eventId });
		}
		sendCapi(eventName, eventId, customData);
		return eventId;
	}

	// Expor helpers para uso futuro
	window.metaCapi = {
		track: track,
		trackPageView: function(){ return track('PageView'); },
		trackContact: function(data){ return track('Contact', data); },
		trackLead: function(data){ return track('Lead', data); }
	};

	// Dispara PageView ao carregar
	document.addEventListener('DOMContentLoaded', function(){
		window.metaCapi.trackPageView();

		// Cliques nas CTAs -> Contact
		document.querySelectorAll('.cta').forEach(function(el){
			el.addEventListener('click', function(){
				const label = (this.textContent || '').trim();
				window.metaCapi.trackContact({ content_name: label });
			}, { passive: true });
		});

		// WhatsApp -> Lead (rodapé e sessão visita)
		document.querySelectorAll('.visit-whatsapp, .footer-whatsapp').forEach(function(el){
			el.addEventListener('click', function(){
				window.metaCapi.trackLead({ content_name: 'WhatsApp' });
			}, { passive: true });
		});
	});
})(); 

