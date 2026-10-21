/** Testi prodotto in lingua "nl" (olandese dei Paesi Bassi, je). Stesse chiavi di testiIt: vedi docs/traduzioni.md (tono, glossario). */
import type { TestiLingua } from './it';

export const testiNl: TestiLingua = {
	prodotti: {
		adesivi_personalizzati: {
			name: 'Stickers op maat', title: 'Stickers op maat', h1: ['Stickers', 'op maat'],
			seoTitle: 'Stickers laten drukken met direct voorbeeld | Stickerprint',
			seoDesc: 'Stickers op maat van vinyl, contourgesneden in elke vorm, mat of glans. Upload je bestand, zie meteen het voorbeeld en bestel vanaf 15 stuks.',
			seoCategory: 'Stickers op maat',
			sub: 'Goed gemaakt. Punt.',
			desc: 'Premium materialen. Druk van topkwaliteit. Precies gesneden. Jij uploadt het bestand, wij regelen de rest.',
			checks: ['Direct automatisch voorbeeld', 'Verwachte levering {ship} · gratis verzending vanaf {soglia}', 'We drukken alleen als het goed wordt', 'Geen verrassingen in het resultaat'],
			cosa: 'Stickers op maat gesneden en gedrukt om lang mee te gaan. Volle kleuren, strakke details, materialen die tegen gebruik, tijd en verzending kunnen. Je plakt ze, verstuurt ze, laat ze rondgaan. En ze doen hun werk. Lang.',
			faq: [
				{ q: 'Wat betekent contourgesneden?', a: 'Bij contoursnijden volgt de snede precies de omtrek van je ontwerp, zonder witte rechthoekige rand. De sticker wordt op maat gesneden met een precisiemachine die de vorm van je bestand volgt, voor een strak en professioneel resultaat.' },
				{ q: 'Heb ik witdruk nodig?', a: 'Meestal niet. Onze stickers op maat worden op wit vinyl gedrukt, dus wit zit er al als basis in. Witdruk heb je alleen nodig als je dekkend wit wilt op transparant of gekleurd materiaal.' },
				{ q: 'Hoe lang gaan ze buiten mee?', a: 'Onze stickers op maat zijn gemaakt van hoogwaardig vinyl met beschermend laminaat. Ze kunnen tegen regen, zon, wind en kou. Onder normale omstandigheden houden ze meerdere jaren hun felle kleuren en hechting, ook buiten.' },
				{ q: 'Hoe wordt de sticker beschermd?', a: 'Elke sticker krijgt een transparant beschermend laminaat dat hem beschermt tegen krassen, uv-straling, vocht en dagelijkse slijtage. Zo blijven de kleuren fel en blijft het oppervlak lang intact.' },
			],
			faqTitle: 'Veelgestelde vragen over stickers op maat',
			cta: 'je stickers op maat',
			compare: {
				titlePre: 'Niet elke sticker is gemaakt om', titleHl: 'lang mee te gaan.', hl: 'blue',
				sub: 'Sommigen besparen op materiaal. Wij besparen liever niet op jouw resultaat.',
				usHead: 'Stickers van Stickerprint', themHead: 'Goedkope stickers',
				rows: [
					{ icon: 'layers', label: 'Materiaal', us: 'Geselecteerd premium vinyl', them: 'Goedkoop materiaal' },
					{ icon: 'print', label: 'Druk', us: 'Verkleurt niet, ook zonder laminaat', them: 'Na een paar dagen verbleekt' },
					{ icon: 'shield', label: 'Bescherming', us: 'Extra beschermend laminaat beschikbaar', them: 'Ontbreekt en niet beschikbaar' },
					{ icon: 'cut', label: 'Snijden', us: 'Precies, ook in een eigen vorm', them: 'Vooral standaardformaten' },
					{ icon: 'sliders', label: 'Personalisatie', us: 'Maten, afwerkingen en materialen naar wens', them: 'Standaardformaten, standaardmateriaal' },
					{ icon: 'people', label: 'Ervaring', us: '19 jaar ervaring in drukwerk', them: 'Niet altijd vermeld' }
				],
				closing: 'Een goedkope sticker kost één keer minder. Een goed gemaakte sticker is elke dag meer waard.',
				cta: 'Maak je stickers →', href: '#preventivatore'
			},
			care: { title: 'Nul stress.', hl: 'Wij regelen het.', intro: 'Je eerste bestelling? Geen zorgen. Dit is de checklist die we bij elke bestelling doorlopen:', checks: ['Elk bestand handmatig gecontroleerd', 'Als het nodig is, fixen we het bestand voor het drukken', 'Automatisch voorbeeld van het resultaat voordat je betaalt', 'Je ziet precies hoe we je product maken', 'We drukken wat je hebt gezien, zonder verrassingen'], closing: '' },
			reviewsTitle: 'Wat ze zeggen over', reviewsHl: 'deze stickers.', reviewsSub: 'Echte bestellingen. Concrete resultaten.'
		},
		adesivi_resinati: {
			name: 'Doming stickers', title: 'Doming stickers',
			seoTitle: 'Doming stickers (3D stickers) op maat laten maken | Stickerprint',
			seoDesc: 'Doming stickers met 3D-koepel: bol effect, diepe kleuren en beschermende hars. Rond, vierkant, ovaal of contourgesneden, met direct voorbeeld.',
			seoCategory: 'Doming stickers',
			sub: 'Echt volume. Premium effect gegarandeerd.',
			desc: 'Bolle, glanzende, driedimensionale afwerking. Voor als je ontwerp niet alleen gezien moet worden. Maar moet opvallen.',
			checks: ['Ultraglanzende premium hars', 'Direct automatisch voorbeeld', 'Verwachte levering {ship} · gratis verzending vanaf {soglia}', 'We drukken alleen als het goed wordt', 'Geen verrassingen in het resultaat'],
			cosa: 'Doming stickers. Een premium effect dat je meteen ziet. Bolle 3D-afwerking, diepere kleuren en een hars die het ontwerp beschermt en versterkt. Voor als een sticker niet alleen moet plakken, maar moet opvallen.',
			faq: [
				{ q: 'Waarom zijn afgeronde hoeken nodig?', a: 'Afgeronde hoeken zijn nodig zodat de hars zich perfect verdeelt. Bij scherpe hoeken verdeelt de hars zich vaak niet gelijkmatig en kunnen er oneffenheden ontstaan. Afgeronde hoeken zorgen voor een gelijkmatige dekking en een vlekkeloos resultaat.' },
				{ q: 'Heb ik witdruk nodig?', a: 'Ja, wit is essentieel bij doming stickers. Omdat de hars transparant is, zouden de kleuren zonder witte basis flets of doorschijnend lijken. Witdruk garandeert felle, heldere kleuren onder de harskoepel.' },
				{ q: 'Hoe lang gaan ze buiten mee?', a: 'Doming stickers zijn extreem goed bestand tegen buitenomstandigheden. De hars beschermt tegen uv-straling, water, weersinvloeden en mechanische slijtage. Onder normale omstandigheden behouden ze meerdere jaren hun uiterlijk, ook buiten.' },
				{ q: 'Hoe wordt de sticker beschermd?', a: 'De sticker wordt beschermd door een transparante koepel van polyurethaanhars, nauwkeurig aangebracht met CNC-machines. Deze koepel vormt een fysieke barrière die de druk eronder beschermt tegen krassen, vocht, uv-straling en chemicaliën.' },
				{ q: 'Welke hars gebruiken jullie?', a: 'We gebruiken hoogwaardige polyurethaanhars, speciaal voor stickers. Het is een tweecomponentenhars die na het uitharden transparant, glanzend en flexibel wordt. Hij vergeelt niet en blijft jarenlang glanzen.' },
			],
			faqTitle: 'Veelgestelde vragen over doming stickers',
			cta: 'je doming stickers',
			care: { title: 'Eerste keer', hl: 'doming stickers?', intro: 'Hars laat het ontwerp uitkomen, maar vraagt om precisie. Daarom controleren we alles voordat we drukken.', checks: ['Controle van het bestand en de gietvlakken', 'Vorm en hoeken gecontroleerd en aangepast', 'Voorbeeld van het bolle effect voordat je bestelt', 'Je ziet precies het eindresultaat', 'We drukken wat je hebt gezien, zonder verrassingen'], closing: 'Geen verrassingen. Alleen stickers zoals het hoort.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'het 3D-effect overtuigt echt', reviewsSub: 'Echte bestellingen. Concrete resultaten.'
		},
		adesivi_rilievo: {
			name: 'Reliëf stickers', title: 'Reliëf stickers',
			seoTitle: 'Reliëf stickers met spot-uv op maat laten drukken | Stickerprint',
			seoDesc: 'Stickers met selectief uv-reliëf: details die je voelt, glans of mat, op maat gesneden. Direct voorbeeld voordat je bestelt. Gedrukt in Italië.',
			seoCategory: 'Reliëf stickers',
			sub: 'Selectief reliëf. Het detail krijgt diepte.',
			desc: 'Spotlak alleen waar het nodig is. Sommige details komen omhoog, andere blijven vlak. Het resultaat? Een sticker die je ziet én voelt.',
			checks: ['Direct automatisch voorbeeld', 'Verwachte levering {ship} · gratis verzending vanaf {soglia}', 'We drukken alleen als het goed wordt', 'Geen verrassingen in het resultaat', 'Reliëfeffect nauwkeurig aangebracht'],
			cosa: 'Reliëf stickers. Details die eruit springen. Ongelooflijke resultaten. Het reliëfeffect wordt alleen op specifieke delen van het ontwerp aangebracht. Sommige elementen blijven vlak, andere krijgen diepte. Het resultaat is een sticker die je niet alleen ziet, maar ook voelt.',
			faq: [
				{ q: 'Hebben reliëf stickers een beschermend laminaat?', a: 'Ja, reliëf stickers worden beschermd met een transparant laminaat dat zowel de druk als het reliëfeffect bewaart. Het laminaat beschermt tegen krassen, uv-straling en weersinvloeden en houdt het 3D-effect lang intact.' },
				{ q: 'Heb ik witdruk nodig?', a: 'Meestal niet. Onze reliëf stickers worden op wit vinyl gedrukt, dus wit zit er al als basis in. Witdruk heb je alleen nodig als je dekkend wit wilt op transparant of gekleurd materiaal.' },
				{ q: 'Hoe lang gaan ze buiten mee?', a: 'Reliëf stickers zijn gemaakt van hoogwaardige materialen met beschermend laminaat. Ze kunnen perfect tegen regen, zon, wind en kou. Het reliëfeffect behoudt zijn structuur en de kleuren blijven meerdere jaren fel, ook buiten.' },
				{ q: 'Waar kan ik het reliëfeffect het beste gebruiken?', a: 'Het reliëfeffect komt het beste tot zijn recht op specifieke details van het ontwerp: logo’s, teksten, randen of grafische elementen die je wilt laten opvallen. We raden af om het op het hele oppervlak te zetten, alleen op de delen die je wilt benadrukken. Het contrast tussen vlakke delen en reliëf zorgt voor het wow-effect.' },
				{ q: 'Wat betekent glans en mat?', a: 'Het reliëfeffect kan in glans of mat worden aangebracht. Glans geeft de reliëfdelen een heldere, reflecterende uitstraling, mat zorgt voor een elegantere, satijnachtige look. De keuze hangt af van het resultaat dat je wilt.' },
			],
			faqTitle: 'Veelgestelde vragen over reliëf stickers',
			cta: 'je reliëf stickers',
			care: { title: 'Precies reliëf.', hl: 'Geen verrassingen.', intro: 'Het reliëf komt alleen waar het telt. Zo is het resultaat precies wat je verwacht.', checks: ['We controleren het bestand en de aangegeven reliëfzones', 'We fixen eventuele technische details', 'We brengen de spotlak alleen aan waar jij dat wilt', 'Voorbeeld van het eindresultaat voordat je bestelt', 'Meteen in druk zodra je de bestelling bevestigt'], closing: 'Resultaat: een precies reliëfeffect dat bij het ontwerp past. Geen experimenten. Geen verrassingen.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'het reliëf maakt het verschil.', reviewsSub: 'Echte bestellingen. Concrete resultaten.'
		},
		etichette: {
			name: 'Etiketten op vellen', title: 'Etiketten op vellen',
			seoTitle: 'Etiketten op vellen laten drukken, op maat | Stickerprint',
			seoDesc: 'Etiketten op maat op vellen voor producten, verpakkingen en verzending: sterke materialen, beschermend laminaat, kiss-cut om ze makkelijk los te halen.',
			seoCategory: 'Zelfklevende etiketten',
			sub: 'Overzicht, snelheid, strak resultaat.',
			desc: 'Meerdere etiketten op één vel, klaar om te plakken. Ideaal voor verpakkingen, producten en verzending. Voor als je gemak en kwaliteit nodig hebt, samen.',
			checks: ['Meerdere etiketten op één vel', 'Makkelijk los te halen, snel met de hand te plakken', 'Materialen bestand tegen water, olie en dagelijks gebruik', 'Beschermende afwerking voor een strak resultaat', 'Direct automatisch voorbeeld'],
			cosa: 'Zelfklevende etiketten op vellen, gemaakt om snel en precies met de hand te plakken. Sterk, leesbaar, betrouwbaar. Voor als de verpakking net zo goed moet zijn als de inhoud.',
			faq: [
				{ q: 'Hebben de etiketten een beschermend laminaat?', a: 'Ja, al onze etiketten op vellen krijgen een transparant beschermend laminaat waardoor ze bestand zijn tegen krassen, water, olie en dagelijks gebruik. Het laminaat zorgt voor een strak en duurzaam resultaat.' },
				{ q: 'Heb ik witdruk nodig?', a: 'Meestal niet. De etiketten worden op wit vinyl gedrukt, dus wit zit er al als basis in. Witdruk heb je alleen nodig als je dekkend wit wilt op transparant of gekleurd materiaal.' },
				{ q: 'Hoe lang gaan ze buiten mee?', a: 'Onze etiketten op vellen zijn gemaakt van hoogwaardige materialen met beschermend laminaat. Ze kunnen tegen water, olie, voedsel en dagelijks gebruik. Ze zijn vooral bedoeld voor verpakkingen, producten en verzending, en behouden lang hun kwaliteit.' },
				{ q: 'Hoe zijn de etiketten op het vel verdeeld?', a: 'De etiketten staan op handige vellen, met de ruimte optimaal benut voor zoveel mogelijk etiketten per vel. Ze zijn voorgesneden en makkelijk los te halen, klaar om snel en precies met de hand te plakken.' },
				{ q: 'Kan ik de vorm van de etiketten kiezen?', a: 'Zeker. We bieden ronde, vierkante, rechthoekige, ovale en contourgesneden etiketten. De snede volgt met geavanceerde techniek precies de omtrek van je ontwerp, tot op de millimeter.' },
			],
			faqTitle: 'Veelgestelde vragen over etiketten op vellen',
			cta: 'je etiketten op vellen',
			care: { title: 'Nul stress.', hl: 'Ook als je veel etiketteert.', intro: 'Jij denkt aan het product. Wij aan de etiketten. Of ze nu voor verkoop, verzending of magazijn zijn, etiketten moeten meteen werken. Daarom controleren we alles voordat het in druk gaat.', checks: ['Controle van bestand en afmetingen', 'Snede en indeling op het vel gecontroleerd', 'Automatisch voorbeeld voordat je betaalt', 'In productie zodra je de bestelling bevestigt', 'Geen verrassingen bij het plakken'], closing: '' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'ze besparen tijd.', reviewsSub: 'En als je veel etiketteert, maakt dat het verschil.'
		},
		fogli_adesivi: {
			name: 'Stickervellen', title: 'Stickervellen',
			seoTitle: 'Stickervellen op maat laten drukken | Stickerprint',
			seoDesc: 'Stickervellen met meerdere ontwerpen op één vel: drie formaten, staand of liggend, kiss-cut op elke sticker. Perfect voor pakketten, merch en collecties.',
			seoCategory: 'Stickervellen',
			sub: 'De slimste manier om pakketten, sets en collecties te maken.',
			desc: 'Zet meerdere stickers, ook verschillende, op één vel. Jij deelt ze in of wij doen het voor je. Ideaal voor merch, evenementen, verpakkingen en kant-en-klare pakketten.',
			checks: ['Direct automatisch voorbeeld', 'Verwachte levering {ship} · gratis verzending vanaf {soglia}', 'Kiss-cut op elke sticker (makkelijk los te halen)', 'Verschillende vormen op hetzelfde vel', 'We drukken alleen als het goed wordt'],
			cosa: 'Stickervellen op maat met meerdere ontwerpen in dezelfde lay-out. Elke sticker is apart gesneden, maar blijft op het vel zitten. Perfect als je variatie, overzicht en een professioneel resultaat wilt.',
			faq: [
				{ q: 'Hoeveel verschillende stickers kan ik op één vel zetten?', a: 'Zoveel je wilt, ook met totaal verschillende ontwerpen. Wij zetten ze in de beste lay-out, of je geeft zelf aan welke indeling je wilt.' },
				{ q: 'Heb ik witdruk nodig?', a: 'Meestal niet. Stickervellen worden op wit vinyl gedrukt, dus wit zit er al als basis in. Witdruk heb je alleen nodig als je dekkend wit wilt op transparant of gekleurd materiaal.' },
				{ q: 'Hoe lang gaan ze buiten mee?', a: 'Onze stickervellen zijn gemaakt van hoogwaardige materialen met beschermend laminaat. Ze kunnen tegen water, olie, voedsel en dagelijks gebruik. Ze zijn vooral bedoeld voor verpakkingen, producten en verzending, en behouden lang hun kwaliteit.' },
				{ q: 'Hoe werkt de kiss-cut?', a: 'Bij een kiss-cut wordt alleen de sticker gesneden, niet het dragervel. Zo haal je elke sticker makkelijk van het vel, klaar om te plakken. De ideale oplossing voor pakketten, sets en collecties.' },
				{ q: 'Kan ik verschillende vormen op hetzelfde vel hebben?', a: 'Zeker. Je kunt ronde, vierkante, rechthoekige, ovale en contourgesneden stickers op hetzelfde vel combineren. Elke sticker krijgt zijn eigen kiss-cut, zodat je sets en collecties helemaal naar wens maakt.' },
			],
			faqTitle: 'Veelgestelde vragen over stickervellen',
			cta: 'je stickervellen',
			care: { title: 'Elke sticker', hl: 'op de juiste plek.', intro: 'Jij denkt aan het ontwerp. Wij regelen de rest, echt.', checks: ['Controle van bestand en snijmarges', 'Kiss-cut op elke sticker gecontroleerd', 'We passen de lay-out aan als dat nodig is', 'Automatisch voorbeeld voordat je betaalt', 'Meteen in druk zodra je de bestelling bevestigt'], closing: 'Geen verrassingen. Geen vel verspild.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'echte bestellingen, echt gebruik.', reviewsSub: 'Eerlijke meningen.'
		},
		vetrofanie: {
			name: 'Raamstickers', title: 'Raamstickers',
			seoTitle: 'Raamstickers laten drukken voor winkels en bedrijven | Stickerprint',
			seoDesc: 'Raamstickers van vinyl, aan de binnenkant van het glas geplakt en van buiten leesbaar: op maat gesneden, scherpe kleuren, direct voorbeeld. Voor etalages.',
			seoCategory: 'Raamstickers',
			sub: 'Zichtbaar van buiten. Perfect van binnen.',
			desc: 'Stickers gemaakt om aan de binnenkant van het glas te plakken en van buiten perfect leesbaar te zijn. Strak, professioneel, gemaakt om lang mee te gaan op etalages, kantoren en winkelruimtes.',
			checks: ['Binnen geplakt, buiten perfect leesbaar', 'Sterk vinyl, scherpe kleuren', 'Precies op maat gesneden', 'Direct automatisch voorbeeld', 'We drukken alleen als het goed wordt'],
			cosa: 'Raamstickers van vinyl met lijm aan de voorkant, ontworpen om aan de binnenkant van etalages en ramen te plakken. Bescherming op lange termijn, strak resultaat, duidelijke en professionele communicatie. Voor als je boodschap net zo lang mee moet gaan als je bedrijf.',
			faq: [
				{ q: 'Hebben raamstickers een beschermend laminaat?', a: 'Ja, onze raamstickers zijn beschermd met een transparant laminaat dat bestand is tegen krassen en uv-straling. De bescherming houdt de kleuren fel en de tekst leesbaar, ook bij direct zonlicht.' },
				{ q: 'Heb ik witdruk nodig?', a: 'Ja, bij raamstickers is wit essentieel. Omdat ze aan de binnenkant van het glas worden geplakt en van buiten gelezen, zorgt witdruk ervoor dat de kleuren dekkend en zichtbaar zijn door het glas. Zonder wit zou de sticker doorschijnend zijn.' },
				{ q: 'Hoe lang gaan ze buiten mee?', a: 'Raamstickers zijn gemaakt om lang mee te gaan. Omdat ze aan de binnenkant van het glas zitten, zijn ze beschermd tegen weersinvloeden van buiten. Het vinyl en het laminaat zijn uv-bestendig en houden de kleuren meerdere jaren scherp.' },
				{ q: 'Hoe plak ik raamstickers?', a: 'Raamstickers plak je aan de binnenkant van het glas, met de lijmzijde naar het oppervlak. Dankzij gespiegeld drukken zijn ze van buiten perfect leesbaar. Plakken is simpel: glas schoonmaken, sticker positioneren en aandrukken om luchtbellen weg te strijken.' },
				{ q: 'Kan ik ze op elk glas gebruiken?', a: 'Ja, raamstickers kun je op elk glad glasoppervlak plakken: etalages, kantoorramen, glazen deuren, autoruiten en meer. De lijm is ontworpen om perfect op glas te hechten en bij het verwijderen geen resten achter te laten.' },
			],
			faqTitle: 'Veelgestelde vragen over raamstickers',
			cta: 'je raamstickers',
			care: { title: 'Nul stress.', hl: 'Ook op glas.', intro: 'Jij uploadt het bestand. Wij regelen de rest. Raamstickers lijken simpel, maar vragen aandacht voor richting, randen en eindresultaat. Daarom controleren we alles voordat we drukken.', checks: ['Controle van richting en spiegeling', 'Randen en snede gecontroleerd voor plakken op glas', 'Automatisch voorbeeld voordat je betaalt', 'We drukken wat je hebt gezien', 'Geen verrassingen in het resultaat'], closing: '' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'ze vallen op. En hoe.', reviewsSub: 'Echte etalages. Echte feedback.'
		}
	},
	kit: { price: '10€', checks: ['Je ontvangt onze beste stickers', 'Je voelt onze kwaliteit met eigen handen', 'Je probeert al onze producten', 'Je kiest het perfecte materiaal voor jou', 'Je krijgt het meteen terug bij je eerste bestelling'] }
};
