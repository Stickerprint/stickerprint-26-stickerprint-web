/**
 * Dati strutturati della home: WebSite (nome del sito su Google) e Organization (chi siamo).
 * Solo dati reali e pubblici: ragione sociale, partita IVA, indirizzo ed email da company.ts, profilo Instagram.
 * Niente AggregateRating qui: Google non accetta le stelle "self-serving" sull'azienda.
 */
import { ORG_ID, SITE_NAME, SITE_URL, WEBSITE_ID } from './seo';

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

export const HOME_LD = [
	{
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': WEBSITE_ID,
		url: `${SITE_URL}/`,
		name: SITE_NAME,
		alternateName: ['Sticker Print', 'stickerprint.it'],
		inLanguage: 'it-IT',
		publisher: { '@id': ORG_ID }
	},
	{
		'@context': 'https://schema.org',
		'@type': 'OnlineStore',
		'@id': ORG_ID,
		name: SITE_NAME,
		legalName: COMPANY.legalName,
		url: `${SITE_URL}/`,
		logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/splogo.png` },
		image: `${SITE_URL}/images/og-stickerprint.jpg`,
		email: COMPANY.email,
		vatID: COMPANY.vat,
		address: { '@type': 'PostalAddress', streetAddress: COMPANY.street, postalCode: COMPANY.zip, addressLocality: COMPANY.city, addressRegion: COMPANY.province, addressCountry: 'IT' },
		areaServed: 'IT',
		availableLanguage: ['it'],
		contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer service', email: COMPANY.email, availableLanguage: ['it'], url: `${SITE_URL}/support` }],
		sameAs: COMPANY.sameAs
	}
];
