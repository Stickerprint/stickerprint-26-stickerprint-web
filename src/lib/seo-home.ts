/**
 * Dati strutturati della home: WebSite (nome del sito su Google) e Organization (chi siamo).
 * Solo dati reali e pubblici: ragione sociale, partita IVA, indirizzo ed email da company.ts, profilo Instagram.
 * Niente AggregateRating qui: Google non accetta le stelle "self-serving" sull'azienda.
 * homeLd(locale): lingua della pagina (inLanguage), paesi serviti da quella lingua (areaServed), lingue online e link al supporto in lingua.
 */
import { ORG_ID, SITE_NAME, SITE_URL, WEBSITE_ID } from './seo';
import { LOCALES, activeLocales, localizePath, type LocaleCode } from './i18n';
import { paesiPer } from './mercati';

const COMPANY = {
	legalName: 'Stickerprint Srl',
	street: 'Via Staffora 20/3',
	zip: '20073',
	city: 'Opera',
	province: 'MI',
	vat: 'IT11308040960',
	email: 'info@stickerprint.it',
	sameAs: ['https://www.instagram.com/stickerprint.it/']
};

export function homeLd(code: LocaleCode = 'it') {
	const loc = LOCALES[code] ?? LOCALES.it;
	const paesi = paesiPer(loc.code);
	const lingue = [...new Set(activeLocales().map((c) => LOCALES[c].lang))];
	const home = `${SITE_URL}${localizePath('/', loc.code)}`;
	return [
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			'@id': WEBSITE_ID,
			url: home,
			name: SITE_NAME,
			alternateName: ['Sticker Print', 'stickerprint.it'],
			inLanguage: loc.intl,
			publisher: { '@id': ORG_ID }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'OnlineStore',
			'@id': ORG_ID,
			name: SITE_NAME,
			legalName: COMPANY.legalName,
			url: home,
			logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/splogo.png` },
			image: `${SITE_URL}/images/og-stickerprint.jpg`,
			email: COMPANY.email,
			vatID: COMPANY.vat,
			address: { '@type': 'PostalAddress', streetAddress: COMPANY.street, postalCode: COMPANY.zip, addressLocality: COMPANY.city, addressRegion: COMPANY.province, addressCountry: 'IT' },
			areaServed: paesi.length === 1 ? paesi[0] : paesi,
			availableLanguage: lingue,
			contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer service', email: COMPANY.email, availableLanguage: lingue, url: `${SITE_URL}${localizePath('/support', loc.code)}` }],
			sameAs: COMPANY.sameAs
		}
	];
}
