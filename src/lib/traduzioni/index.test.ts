import { describe, expect, it as prova } from 'vitest';
import { t, MESSAGGI } from './index';
const it = MESSAGGI.it;
import { localeFromPath, localizePath, detectLocale, toCurrency } from '$lib/i18n';

const chiavi = (o: object, pre = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [pre + k] : chiavi(v as object, `${pre}${k}.`)));

describe('traduzioni', () => {
	prova('ogni lingua ha tutte le chiavi dell\'italiano, senza testi vuoti', () => {
		const base = chiavi(it);
		for (const [lang, m] of Object.entries(MESSAGGI)) {
			expect(chiavi(m), lang).toEqual(base);
			for (const k of base) expect(t(lang === 'en' ? 'en' : (lang as 'it'), k), `${lang}.${k}`).not.toBe('');
		}
	});
	prova('t riempie i segnaposto e torna la chiave se manca', () => {
		expect(t('de', 'footer.spedizioneGratis', { soglia: '69 €' })).toBe('Kostenloser Versand ab 69 €');
		expect(t('it', 'non.esiste')).toBe('non.esiste');
	});
});
describe('percorsi', () => {
	prova('il prefisso della lingua si legge e si mette', () => {
		expect(localeFromPath('/de/adesivi-personalizzati')).toEqual({ code: 'de', rest: '/adesivi-personalizzati' });
		expect(localeFromPath('/de')).toEqual({ code: 'de', rest: '/' });
		expect(localeFromPath('/design')).toEqual({ code: null, rest: '/design' });
		expect(localizePath('/adesivi-personalizzati', 'us')).toBe('/us/custom-stickers');
		expect(localizePath('/de/warenkorb', 'fr')).toBe('/fr/panier');
		expect(localeFromPath('/de/individuelle-aufkleber/x')).toEqual({ code: 'de', rest: '/adesivi-personalizzati/x' });
		expect(localizePath('/blog/ciao', 'de')).toBe('/de/blog/ciao');
		expect(localizePath('/account/ordini', 'es')).toBe('/es/cuenta/ordini');
		expect(localizePath('/fr/', 'it')).toBe('/');
		expect(localizePath('/api/carrello', 'de')).toBe('/api/carrello');
		expect(localizePath('/dashboard', 'de')).toBe('/dashboard');
	});
	prova('il suggerimento segue paese e browser, solo fra le lingue online', () => {
		expect(detectLocale('DE', 'de-DE,de;q=0.9')).toBe('de');
		expect(detectLocale('US', 'en-US')).toBe('us');
		expect(detectLocale('BE', 'fr-BE,fr')).toBe('fr');
		expect(detectLocale('GB', 'en-GB')).toBe('en');
		expect(detectLocale('PT', 'pt-PT')).toBe('en');
		expect(detectLocale('CH', 'de-CH')).toBe('it');
		expect(detectLocale(null, 'en-GB,en')).toBe('en');
		expect(detectLocale('PT', 'pt-PT', ['it', 'us'])).toBe('it');
		expect(detectLocale('GB', 'en-GB', ['it', 'us'])).toBe('us');
		expect(detectLocale('DE', 'de', ['it', 'us'])).toBe('it');
	});
});
describe('valute', () => {
	prova('il dollaro usa cambio e arrotondamento del listino', () => {
		expect(toCurrency(10, 'EUR')).toBe(10);
		// 12,20 € IVA inclusa → 10 € netti → × 1,12 × 1,10 = 12,32 → 12,30 $
		expect(toCurrency(12.2, 'USD')).toBe(12.3);
		expect(toCurrency(10, 'USD', false)).toBe(12.3);
	});
});
