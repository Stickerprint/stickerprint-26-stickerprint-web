/** Testi prodotto in lingua "de" (tedesco, du). Stesse chiavi di testiIt: vedi docs/traduzioni.md (tono, glossario). */
import type { TestiLingua } from './it';

export const testiDe: TestiLingua = {
	prodotti: {
		adesivi_personalizzati: {
			name: 'Individuelle Aufkleber', title: 'Individuelle Aufkleber', h1: ['Individuelle', 'Aufkleber'],
			seoTitle: 'Aufkleber drucken lassen mit Sofort-Vorschau | Stickerprint',
			seoDesc: 'Individuelle Aufkleber aus Vinyl, konturgeschnitten in jeder Form, matt oder glänzend. Datei hochladen, Vorschau sofort sehen, ab 15 Stück bestellen.',
			seoCategory: 'Individuelle Aufkleber',
			sub: 'Richtig gut gemacht. Punkt.',
			desc: 'Premium-Materialien. Druck in Top-Qualität. Präziser Schnitt. Du lädst die Datei hoch, um den Rest kümmern wir uns.',
			checks: ['Automatische Vorschau sofort', 'Voraussichtliche Lieferung {ship} · kostenloser Versand ab {soglia}', 'Wir drucken nur, wenn es gut wird', 'Keine Überraschungen beim Ergebnis'],
			cosa: 'Aufkleber, auf Maß geschnitten und gedruckt, um lange zu halten. Satte Farben, saubere Details, Materialien, die Gebrauch, Zeit und Versand aushalten. Du klebst sie, verschickst sie, bringst sie in Umlauf. Und sie machen ihren Job. Lange.',
			faq: [
				{ q: 'Was bedeutet Konturschnitt?', a: 'Beim Konturschnitt folgt der Schnitt exakt dem Umriss deines Designs, ohne weißen rechteckigen Rand. Der Aufkleber wird auf Maß mit einer Präzisionsmaschine geschnitten, die der Form deiner Grafikdatei folgt – für ein sauberes, professionelles Ergebnis.' },
				{ q: 'Brauche ich Weißdruck?', a: 'In der Regel nein. Unsere individuellen Aufkleber werden auf weißes Vinyl gedruckt, Weiß ist also schon als Grundlage da. Weißdruck brauchst du nur, wenn du ein deckendes Weiß auf transparenten oder farbigen Materialien möchtest.' },
				{ q: 'Wie lange halten sie im Außenbereich?', a: 'Unsere individuellen Aufkleber bestehen aus hochwertigem Vinyl mit schützender Laminierung. Sie halten Regen, Sonne, Wind und Kälte stand. Unter normalen Bedingungen behalten sie ihre leuchtenden Farben und ihre Haftung mehrere Jahre lang, auch im Freien.' },
				{ q: 'Wie wird der Aufkleber geschützt?', a: 'Jeder Aufkleber wird mit einer transparenten Schutzlaminierung überzogen, die ihn vor Kratzern, UV-Strahlen, Feuchtigkeit und täglicher Abnutzung schützt. So bleiben die Farben kräftig und die Oberfläche lange intakt.' },
			],
			faqTitle: 'Häufige Fragen zu individuellen Aufklebern',
			cta: 'deine individuellen Aufkleber',
			compare: {
				titlePre: 'Nicht alle Aufkleber sind gemacht, um zu', titleHl: 'halten.', hl: 'blue',
				sub: 'Manche sparen am Material. Wir sparen lieber nicht an deinem Ergebnis.',
				usHead: 'Stickerprint-Aufkleber', themHead: 'Billig-Aufkleber',
				rows: [
					{ icon: 'layers', label: 'Material', us: 'Ausgewählte Premium-Vinyle', them: 'Billige Materialien' },
					{ icon: 'print', label: 'Druck', us: 'Verblasst nicht, auch ohne Laminierung', them: 'Nach wenigen Tagen verblasst' },
					{ icon: 'shield', label: 'Schutz', us: 'Zusätzliche Schutzlaminierung verfügbar', them: 'Fehlt und ist nicht verfügbar' },
					{ icon: 'cut', label: 'Schnitt', us: 'Präzise, auch bei individueller Kontur', them: 'Eher standardisierte Formate' },
					{ icon: 'sliders', label: 'Personalisierung', us: 'Maße, Veredelungen und Materialien nach Wunsch', them: 'Standardformate, Standardmaterialien' },
					{ icon: 'people', label: 'Erfahrung', us: '19 Jahre Erfahrung im Druck', them: 'Nicht immer angegeben' }
				],
				closing: 'Ein billiger Aufkleber kostet einmal weniger. Ein gut gemachter Aufkleber ist jeden Tag mehr wert.',
				cta: 'Gestalte deine Aufkleber →', href: '#preventivatore'
			},
			care: { title: 'Null Stress.', hl: 'Wir kümmern uns drum.', intro: 'Deine erste Bestellung? Keine Sorge. Das ist die Checkliste, die wir bei jeder Bestellung durchgehen:', checks: ['Manuelle Prüfung jeder Datei', 'Wenn nötig, bringen wir die Datei vor dem Druck in Ordnung', 'Automatische Vorschau des Ergebnisses vor dem Bezahlen', 'Du siehst genau, wie wir dein Produkt umsetzen', 'Wir drucken, was du gesehen hast – ohne Überraschungen'], closing: '' },
			reviewsTitle: 'Was andere über', reviewsHl: 'diese Aufkleber sagen.', reviewsSub: 'Echte Bestellungen. Konkrete Ergebnisse.'
		},
		adesivi_resinati: {
			name: 'Doming-Aufkleber', title: 'Doming-Aufkleber',
			seoTitle: 'Doming-Aufkleber (3D-Aufkleber) individuell drucken lassen | Stickerprint',
			seoDesc: 'Doming-Aufkleber mit 3D-Kuppel: gewölbter Effekt, tiefe Farben und schützendes Harz. Rund, quadratisch, oval oder konturgeschnitten, mit Sofort-Vorschau.',
			seoCategory: 'Doming-Aufkleber',
			sub: 'Echtes Volumen. Premium-Effekt garantiert.',
			desc: 'Gewölbte, glänzende, dreidimensionale Oberfläche. Wenn dein Design nicht nur gesehen werden soll. Sondern auffallen.',
			checks: ['Ultraglänzendes Premium-Harz', 'Automatische Vorschau sofort', 'Voraussichtliche Lieferung {ship} · kostenloser Versand ab {soglia}', 'Wir drucken nur, wenn es gut wird', 'Keine Überraschungen beim Ergebnis'],
			cosa: 'Doming-Aufkleber. Ein Premium-Effekt, den man sofort sieht. Gewölbte 3D-Oberfläche, tiefere Farben und ein Harz, das das Design schützt und zur Geltung bringt. Wenn der Aufkleber nicht nur kleben, sondern herausstechen soll.',
			faq: [
				{ q: 'Warum braucht es abgerundete Ecken?', a: 'Abgerundete Ecken sind nötig, damit sich das Harz perfekt verteilt. Bei spitzen Ecken verteilt sich das Harz oft ungleichmäßig und es können Fehler entstehen. Abgerundete Ecken sorgen für eine gleichmäßige Abdeckung und ein makelloses Ergebnis.' },
				{ q: 'Brauche ich Weißdruck?', a: 'Ja, Weiß ist bei Doming-Aufklebern entscheidend. Da das Harz transparent ist, würden die Farben ohne weiße Grundlage blass oder durchscheinend wirken. Der Weißdruck garantiert kräftige, leuchtende Farben unter der Harzkuppel.' },
				{ q: 'Wie lange halten sie im Außenbereich?', a: 'Doming-Aufkleber sind extrem widerstandsfähig gegen äußere Einflüsse. Das Harz schützt vor UV-Strahlen, Wasser, Witterung und mechanischer Abnutzung. Unter normalen Bedingungen behalten sie ihr Aussehen mehrere Jahre lang, auch im Freien.' },
				{ q: 'Wie wird der Aufkleber geschützt?', a: 'Der Aufkleber wird durch eine transparente Polyurethan-Harzkuppel geschützt, die mit CNC-Maschinen präzise aufgetragen wird. Diese Kuppel bildet eine physische Barriere, die den Druck darunter vor Kratzern, Feuchtigkeit, UV-Strahlen und Chemikalien schützt.' },
				{ q: 'Welches Harz verwendet ihr?', a: 'Wir verwenden hochwertiges Polyurethan-Harz, das speziell für Aufkleber entwickelt wurde. Es ist ein Zweikomponenten-Harz, das nach dem Aushärten transparent, glänzend und flexibel wird. Es vergilbt nicht und behält seinen Glanz über Jahre.' },
			],
			faqTitle: 'Häufige Fragen zu Doming-Aufklebern',
			cta: 'deine Doming-Aufkleber',
			care: { title: 'Das erste Mal', hl: 'Doming-Aufkleber?', intro: 'Harz bringt das Design zur Geltung, muss aber präzise verarbeitet werden. Deshalb prüfen wir alles, bevor wir drucken.', checks: ['Prüfung der Datei und der Gießflächen', 'Kontrolle und Anpassung von Kontur und Ecken', 'Vorschau des 3D-Effekts vor der Bestellung', 'Du siehst genau das Endergebnis', 'Wir drucken, was du gesehen hast – ohne Überraschungen'], closing: 'Keine Überraschungen. Nur Aufkleber, wie sie sein sollen.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'der 3D-Effekt überzeugt wirklich', reviewsSub: 'Echte Bestellungen. Konkrete Ergebnisse.'
		},
		adesivi_rilievo: {
			name: 'Relief-Aufkleber', title: 'Relief-Aufkleber',
			seoTitle: 'Relief-Aufkleber mit partiellem UV-Lack drucken lassen | Stickerprint',
			seoDesc: 'Aufkleber mit partiellem UV-Relief: Details, die man fühlen kann, glänzend oder matt, Schnitt nach Maß. Sofort-Vorschau vor der Bestellung. Gedruckt in Italien.',
			seoCategory: 'Relief-Aufkleber',
			sub: 'Partielles Relief. Das Detail bekommt Tiefe.',
			desc: 'Spotlack nur dort, wo er gebraucht wird. Manche Details treten hervor, andere bleiben flach. Das Ergebnis? Ein Aufkleber, den man sieht und fühlt.',
			checks: ['Automatische Vorschau sofort', 'Voraussichtliche Lieferung {ship} · kostenloser Versand ab {soglia}', 'Wir drucken nur, wenn es gut wird', 'Keine Überraschungen beim Ergebnis', 'Relief-Effekt präzise aufgetragen'],
			cosa: 'Relief-Aufkleber. Details, die hervortreten. Unglaubliche Ergebnisse. Der Relief-Effekt wird nur auf bestimmte Teile der Grafik aufgetragen. Manche Elemente bleiben flach, andere bekommen Tiefe. Das Ergebnis ist ein Aufkleber, den man nicht nur sieht, sondern auch fühlt.',
			faq: [
				{ q: 'Haben Relief-Aufkleber eine Schutzlaminierung?', a: 'Ja, Relief-Aufkleber werden mit einer transparenten Laminierung geschützt, die sowohl den Druck als auch den Relief-Effekt bewahrt. Die Laminierung schützt vor Kratzern, UV-Strahlen und Witterung und hält den 3D-Effekt lange intakt.' },
				{ q: 'Brauche ich Weißdruck?', a: 'In der Regel nein. Unsere Relief-Aufkleber werden auf weißes Vinyl gedruckt, Weiß ist also schon als Grundlage da. Weißdruck brauchst du nur, wenn du ein deckendes Weiß auf transparenten oder farbigen Materialien möchtest.' },
				{ q: 'Wie lange halten sie im Außenbereich?', a: 'Relief-Aufkleber bestehen aus hochwertigen Materialien mit Schutzlaminierung. Sie halten Regen, Sonne, Wind und Kälte problemlos stand. Der Relief-Effekt behält seine Struktur und die Farben bleiben mehrere Jahre lang leuchtend, auch im Freien.' },
				{ q: 'Wo wirkt der Relief-Effekt am besten?', a: 'Der Relief-Effekt wirkt am besten auf bestimmten Details des Designs: Logos, Schriftzüge, Konturen oder Grafikelemente, die du hervorheben willst. Wir empfehlen, ihn nicht auf die ganze Fläche aufzutragen, sondern nur auf die Teile, die auffallen sollen. Der Kontrast zwischen flachen und erhabenen Bereichen macht den Wow-Effekt.' },
				{ q: 'Was bedeutet glänzend und matt?', a: 'Der Relief-Effekt kann glänzend oder matt ausgeführt werden. Glänzend sorgt für einen strahlenden, reflektierenden Look auf den erhabenen Bereichen, matt wirkt eleganter und seidig. Die Wahl hängt vom gewünschten Look ab.' },
			],
			faqTitle: 'Häufige Fragen zu Relief-Aufklebern',
			cta: 'deine Relief-Aufkleber',
			care: { title: 'Präzises Relief.', hl: 'Keine Überraschungen.', intro: 'Das Relief kommt nur dorthin, wo es zählt. So ist das Ergebnis genau das, was du erwartest.', checks: ['Wir prüfen die Datei und die für das Relief markierten Bereiche', 'Wir bringen technische Details in Ordnung', 'Wir tragen den Spotlack nur dort auf, wo du ihn willst', 'Vorschau des Endergebnisses vor der Bestellung', 'Im Druck, sobald du die Bestellung bestätigst'], closing: 'Ergebnis: ein präziser Relief-Effekt, der zum Design passt. Keine Experimente. Keine Überraschungen.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'das Relief macht den Unterschied.', reviewsSub: 'Echte Bestellungen. Konkrete Ergebnisse.'
		},
		etichette: {
			name: 'Etiketten auf Bögen', title: 'Etiketten auf Bögen',
			seoTitle: 'Etiketten auf Bögen individuell drucken lassen | Stickerprint',
			seoDesc: 'Individuelle Etiketten auf Bögen für Produkte, Verpackungen und Versand: robuste Materialien, Schutzlaminierung, Anstanzung zum leichten Abziehen.',
			seoCategory: 'Klebeetiketten',
			sub: 'Ordnung, Tempo, sauberes Ergebnis.',
			desc: 'Mehrere Etiketten auf einem Bogen, bereit zum Aufkleben. Ideal für Verpackungen, Produkte und Versand. Wenn du Praktisches und Qualität brauchst – zusammen.',
			checks: ['Mehrere Etiketten auf einem Bogen', 'Leicht abzuziehen, schnell von Hand aufgeklebt', 'Materialien, die Wasser, Öl und täglichem Gebrauch standhalten', 'Schutzveredelung für ein sauberes Ergebnis', 'Automatische Vorschau sofort'],
			cosa: 'Klebeetiketten auf Bögen angeordnet, gemacht, um schnell und präzise von Hand aufgeklebt zu werden. Robust, gut lesbar, zuverlässig. Wenn die Verpackung dem Inhalt gerecht werden soll.',
			faq: [
				{ q: 'Haben die Etiketten eine Schutzlaminierung?', a: 'Ja, alle unsere Etiketten auf Bögen werden mit einer transparenten Schutzlaminierung überzogen, die sie widerstandsfähig gegen Kratzer, Wasser, Öl und täglichen Gebrauch macht. Die Laminierung sorgt für ein sauberes, dauerhaftes Ergebnis.' },
				{ q: 'Brauche ich Weißdruck?', a: 'In der Regel nein. Die Etiketten werden auf weißes Vinyl gedruckt, Weiß ist also schon als Grundlage da. Weißdruck brauchst du nur, wenn du ein deckendes Weiß auf transparenten oder farbigen Materialien möchtest.' },
				{ q: 'Wie lange halten sie im Außenbereich?', a: 'Unsere Etiketten auf Bögen bestehen aus hochwertigen Materialien mit Schutzlaminierung. Sie halten Wasser, Öl, Lebensmitteln und täglichem Gebrauch stand. Sie sind vor allem für Verpackungen, Produkte und Versand gedacht und behalten ihre Qualität lange.' },
				{ q: 'Wie sind die Etiketten auf dem Bogen angeordnet?', a: 'Die Etiketten werden auf praktischen Bögen angeordnet, mit optimal genutztem Platz für möglichst viele Etiketten pro Bogen. Sie sind vorgestanzt und leicht abzuziehen, bereit zum schnellen und präzisen Aufkleben von Hand.' },
				{ q: 'Kann ich die Form der Etiketten wählen?', a: 'Auf jeden Fall. Wir bieten runde, quadratische, rechteckige, ovale und konturgeschnittene Etiketten. Der Schnitt folgt mit modernster Technik exakt dem Umriss deines Designs – millimetergenau.' },
			],
			faqTitle: 'Häufige Fragen zu Etiketten auf Bögen',
			cta: 'deine Etiketten auf Bögen',
			care: { title: 'Null Stress.', hl: 'Auch wenn du viel etikettierst.', intro: 'Du kümmerst dich ums Produkt. Wir uns um die Etiketten. Ob für Verkauf, Versand oder Lager: Etiketten müssen sofort funktionieren. Deshalb prüfen wir alles, bevor es in den Druck geht.', checks: ['Prüfung von Datei und Maßen', 'Kontrolle von Schnitt und Anordnung auf dem Bogen', 'Automatische Vorschau vor dem Bezahlen', 'In Produktion, sobald du die Bestellung bestätigst', 'Keine Überraschungen beim Aufkleben'], closing: '' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'sie sparen Zeit.', reviewsSub: 'Und wer viel etikettiert, merkt den Unterschied.'
		},
		fogli_adesivi: {
			name: 'Stickerbögen', title: 'Stickerbögen',
			seoTitle: 'Stickerbögen individuell drucken lassen | Stickerprint',
			seoDesc: 'Stickerbögen mit mehreren Motiven auf einem Bogen: drei Formate, hoch oder quer, Anstanzung auf jedem Sticker. Perfekt für Sets, Merch und Sammlungen.',
			seoCategory: 'Stickerbögen',
			sub: 'Der smarteste Weg zu Sets, Kits und Sammlungen.',
			desc: 'Bring mehrere Sticker, auch ganz unterschiedliche, auf einem einzigen Bogen unter. Du ordnest sie an oder wir machen es für dich. Ideal für Merch, Events, Verpackungen und fertige Sets.',
			checks: ['Automatische Vorschau sofort', 'Voraussichtliche Lieferung {ship} · kostenloser Versand ab {soglia}', 'Anstanzung auf jedem Sticker (leicht abzuziehen)', 'Verschiedene Formen auf demselben Bogen', 'Wir drucken nur, wenn es gut wird'],
			cosa: 'Individuelle Stickerbögen mit mehreren Motiven im selben Layout. Jeder Sticker ist einzeln geschnitten, bleibt aber auf dem Bogen. Perfekt, wenn du Vielfalt, Ordnung und ein professionelles Ergebnis willst.',
			faq: [
				{ q: 'Wie viele verschiedene Sticker passen auf einen Bogen?', a: 'So viele du willst, auch mit ganz unterschiedlichen Motiven. Wir ordnen sie im optimalen Layout an, oder du sagst uns, welche Anordnung du bevorzugst.' },
				{ q: 'Brauche ich Weißdruck?', a: 'In der Regel nein. Stickerbögen werden auf weißes Vinyl gedruckt, Weiß ist also schon als Grundlage da. Weißdruck brauchst du nur, wenn du ein deckendes Weiß auf transparenten oder farbigen Materialien möchtest.' },
				{ q: 'Wie lange halten sie im Außenbereich?', a: 'Unsere Stickerbögen bestehen aus hochwertigen Materialien mit Schutzlaminierung. Sie halten Wasser, Öl, Lebensmitteln und täglichem Gebrauch stand. Sie sind vor allem für Verpackungen, Produkte und Versand gedacht und behalten ihre Qualität lange.' },
				{ q: 'Wie funktioniert die Anstanzung?', a: 'Bei der Anstanzung (Kiss-Cut) wird nur der Sticker geschnitten, nicht das Trägerpapier. So lässt sich jeder Sticker leicht vom Bogen abziehen und ist sofort einsatzbereit. Die ideale Lösung für Sets, Kits und Sammlungen.' },
				{ q: 'Kann ich verschiedene Formen auf demselben Bogen haben?', a: 'Auf jeden Fall. Du kannst runde, quadratische, rechteckige, ovale und konturgeschnittene Sticker auf demselben Bogen kombinieren. Jeder Sticker bekommt seine eigene Anstanzung, so entstehen Sets und Sammlungen ganz nach deinen Wünschen.' },
			],
			faqTitle: 'Häufige Fragen zu Stickerbögen',
			cta: 'deine Stickerbögen',
			care: { title: 'Jeder Sticker', hl: 'am richtigen Platz.', intro: 'Du kümmerst dich ums Design. Um den Rest kümmern wir uns – wirklich.', checks: ['Prüfung von Datei und Schnitträndern', 'Kontrolle der Anstanzung auf jedem Sticker', 'Wir passen das Layout an, wenn nötig', 'Automatische Vorschau vor dem Bezahlen', 'Im Druck, sobald du die Bestellung bestätigst'], closing: 'Keine Überraschungen. Kein verschwendeter Bogen.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'echte Bestellungen, echter Einsatz.', reviewsSub: 'Ehrliche Meinungen.'
		},
		vetrofanie: {
			name: 'Fensteraufkleber', title: 'Fensteraufkleber',
			seoTitle: 'Fensteraufkleber für Schaufenster und Büros drucken lassen | Stickerprint',
			seoDesc: 'Fensteraufkleber aus Vinyl, innen auf die Scheibe geklebt und von außen lesbar: Schnitt nach Maß, klare Farben, Sofort-Vorschau. Für Schaufenster und Büros.',
			seoCategory: 'Fensteraufkleber',
			sub: 'Draußen sichtbar. Drinnen perfekt.',
			desc: 'Aufkleber, die innen auf die Scheibe kommen und von außen perfekt lesbar sind. Sauber, professionell, gemacht, um an Schaufenstern, Büros und Geschäftsräumen lange zu halten.',
			checks: ['Innen angebracht, außen perfekt lesbar', 'Robustes Vinyl, klare Farben', 'Präziser Schnitt nach Maß', 'Automatische Vorschau sofort', 'Wir drucken nur, wenn es gut wird'],
			cosa: 'Fensteraufkleber aus Vinyl mit Kleber auf der Vorderseite, entwickelt für die Anbringung auf der Innenseite von Schaufenstern und Fenstern. Langer Schutz, sauberes Ergebnis, klare und professionelle Kommunikation. Wenn die Botschaft so lange halten soll wie dein Business.',
			faq: [
				{ q: 'Haben Fensteraufkleber eine Schutzlaminierung?', a: 'Ja, unsere Fensteraufkleber sind mit einer transparenten Laminierung geschützt, die Kratzern und UV-Strahlen standhält. Der Schutz hält Farben und Lesbarkeit lange erhalten, auch bei direktem Lichteinfall.' },
				{ q: 'Brauche ich Weißdruck?', a: 'Ja, bei Fensteraufklebern ist Weiß entscheidend. Da sie innen auf der Scheibe angebracht und von außen gelesen werden, sorgt der Weißdruck dafür, dass die Farben deckend und durch das Glas sichtbar sind. Ohne Weiß wäre der Aufkleber durchscheinend.' },
				{ q: 'Wie lange halten sie im Außenbereich?', a: 'Fensteraufkleber sind gemacht, um lange zu halten. Da sie innen auf der Scheibe sitzen, sind sie vor Witterung geschützt. Vinyl und Laminierung sind UV-beständig und halten die Farben mehrere Jahre lang klar.' },
				{ q: 'Wie bringe ich Fensteraufkleber an?', a: 'Fensteraufkleber werden innen auf die Scheibe geklebt, mit der Klebeseite zur Oberfläche. Dank Spiegeldruck sind sie von außen perfekt lesbar. Die Anbringung ist einfach: Scheibe reinigen, Aufkleber positionieren und andrücken, um Luftblasen herauszustreichen.' },
				{ q: 'Kann ich sie auf jedem Glas verwenden?', a: 'Ja, Fensteraufkleber haften auf jeder glatten Glasfläche: Schaufenster, Bürofenster, Glastüren, Autoscheiben und vieles mehr. Der Kleber ist so entwickelt, dass er perfekt am Glas haftet und sich rückstandsfrei entfernen lässt.' },
			],
			faqTitle: 'Häufige Fragen zu Fensteraufklebern',
			cta: 'deine Fensteraufkleber',
			care: { title: 'Null Stress.', hl: 'Auch auf Glas.', intro: 'Du lädst die Datei hoch. Wir kümmern uns um den Rest. Fensteraufkleber wirken simpel, brauchen aber Aufmerksamkeit bei Ausrichtung, Rändern und Endergebnis. Deshalb prüfen wir alles, bevor wir drucken.', checks: ['Prüfung von Ausrichtung und Spiegelung', 'Kontrolle von Rändern und Schnitt für die Anbringung auf Glas', 'Automatische Vorschau vor dem Bezahlen', 'Wir drucken, was du gesehen hast', 'Keine Überraschungen beim Ergebnis'], closing: '' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'sie fallen auf. Und wie.', reviewsSub: 'Echte Schaufenster. Echtes Feedback.'
		}
	},
	kit: { price: '10€', checks: ['Du bekommst unsere besten Aufkleber', 'Du fühlst unsere Qualität mit eigenen Händen', 'Du testest alle unsere Produkte', 'Du wählst das perfekte Material für dich', 'Du bekommst den Betrag bei der ersten Bestellung sofort zurück'] }
};
