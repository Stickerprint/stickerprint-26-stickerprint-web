/** Contenuti delle pagine prodotto: testi e foto ripresi da stickerprint.it, adattati al nuovo stile. */
export interface ProductContent {
	slug: string; route: string; name: string; title: string; sub: string; desc: string; checks: string[]; cosa: string;
	gallery: string[]; others: string[]; faq: { q: string; a: string }[]; faqTitle: string;
	engineProduct: 'sticker' | 'resinati'; cta: string;
	care: { title: string; hl: string; intro: string; checks: string[]; closing: string };
	reviewsTitle: string; reviewsHl: string; reviewsSub: string;
}

/** Kit campioni: blocco comune a tutte le pagine prodotto */
export const KIT = { price: '10€', checks: ['Ricevi i nostri migliori adesivi', 'Tocchi con mano la nostra qualità', 'Prova tutti i nostri prodotti', 'Scegli il materiale perfetto per te', 'Li recuperi subito sul primo ordine'], img: '/images/home/kit-campioni.webp' };

export const PRODUCTS: Record<string, ProductContent> = {
	adesivi_personalizzati: {
		slug: 'adesivi_personalizzati', route: '/adesivi-personalizzati', name: 'Adesivi personalizzati', title: 'Adesivi personalizzati',
		sub: 'Fatti bene. Punto.',
		desc: 'Materiali premium. Stampa di alta qualità. Taglio preciso. Carichi il file, al resto pensiamo noi.',
		checks: ['Prova di stampa gratuita', 'Spedizione veloce: pronti per la spedizione il {ship}', 'Stampiamo solo se viene bene', 'Nessuna sorpresa sul risultato'],
		cosa: 'Adesivi tagliati su misura e stampati per durare. Colori pieni, dettagli puliti, materiali che reggono uso, tempo e spedizioni. Li attacchi, li spedisci, li fai girare. E fanno il loro lavoro. A lungo.',
		gallery: ['/images/prodotti/adesivi-personalizzati/1.webp', '/images/prodotti/adesivi-personalizzati/2.webp', '/images/prodotti/adesivi-personalizzati/3.webp', '/images/prodotti/adesivi-personalizzati/4.webp', '/images/prodotti/adesivi-personalizzati/5.webp', '/images/prodotti/adesivi-personalizzati/6.webp', '/images/prodotti/adesivi-personalizzati/7.webp', '/images/prodotti/adesivi-personalizzati/8.webp'],
		others: ['/images/prodotti/adesivi-personalizzati/other-2.webp', '/images/prodotti/adesivi-personalizzati/other-3.webp', '/images/prodotti/adesivi-personalizzati/other-4.webp'],
		faq: [
			{ q: 'Cosa significa taglio sagomato?', a: 'Il taglio sagomato segue esattamente il contorno del tuo design, eliminando il bordo bianco rettangolare. L’adesivo viene tagliato su misura con una macchina di precisione che segue la forma del tuo file grafico, creando un risultato professionale e pulito.' },
			{ q: 'Serve la stampa del colore bianco?', a: 'In genere no. I nostri adesivi personalizzati vengono stampati su vinile bianco, quindi il bianco è già presente come base. Il colore bianco in stampa serve solo se hai bisogno di un bianco coprente su materiali trasparenti o colorati.' },
			{ q: 'Quanto resiste all’esterno?', a: 'I nostri adesivi personalizzati sono realizzati in vinile di alta qualità con lamina protettiva. Resistono a pioggia, sole, vento e freddo. In condizioni normali mantengono colori brillanti e aderenza per diversi anni, anche in ambienti esterni.' },
			{ q: 'Come viene protetto l’adesivo?', a: 'Ogni adesivo viene rivestito con una lamina protettiva trasparente che lo protegge da graffi, raggi UV, umidità e usura quotidiana. Questa protezione mantiene i colori vividi e la superficie intatta nel tempo.' },
		],
		faqTitle: 'Domande frequenti sugli Adesivi personalizzati',
		engineProduct: 'sticker', cta: 'i tuoi Adesivi personalizzati',
		care: { title: 'Zero ansia.', hl: 'Ci pensiamo noi.', intro: 'È il tuo primo ordine? Non ti preoccupare. Ecco la checklist che eseguiamo su ogni ordine:', checks: ['Controllo manuale di ogni file', 'Se serve, sistemiamo il file prima di stampare', 'Ti mandiamo una prova da approvare', 'Vedrai esattamente come realizzeremo il tuo prodotto', 'Solo dopo il tuo ok andiamo in stampa'], closing: '' },
		reviewsTitle: 'Cosa dicono di', reviewsHl: 'questi adesivi.', reviewsSub: 'Ordini reali. Risultati concreti.'
	},
	adesivi_resinati: {
		slug: 'adesivi_resinati', route: '/adesivi-resinati', name: 'Adesivi resinati', title: 'Adesivi Resinati',
		sub: 'Volume vero. Effetto premium assicurato.',
		desc: 'Finitura bombata, lucida e tridimensionale. Quando il design non deve solo vedersi. Deve farsi notare.',
		checks: ['Resina premium ultra brillante', 'Prova di stampa gratuita', 'Spedizione veloce: pronti per la spedizione il {ship}', 'Stampiamo solo se viene bene', 'Nessuna sorpresa sul risultato'],
		cosa: 'Adesivi resinati. Effetto premium che si vede da subito. Finitura bombata 3D, colori più profondi e una resina che protegge e valorizza il design. Quando l\'adesivo non deve solo attaccarsi, ma distinguersi.',
		gallery: ['/images/prodotti/resinati/1.webp', '/images/prodotti/resinati/2.webp', '/images/prodotti/resinati/3.webp', '/images/prodotti/resinati/4.webp', '/images/prodotti/resinati/5.webp', '/images/prodotti/resinati/6.webp', '/images/prodotti/resinati/7.webp'],
		others: ['/images/prodotti/resinati/other-2.webp', '/images/prodotti/resinati/other-3.webp', '/images/prodotti/resinati/other-4.webp'],
		faq: [
			{ q: 'Perché servono angoli arrotondati?', a: 'Gli angoli arrotondati sono necessari per garantire una perfetta colata della resina. Con angoli vivi, la resina tende a non distribuirsi uniformemente e può creare imperfezioni. Gli angoli arrotondati assicurano una copertura omogenea e un risultato impeccabile.' },
			{ q: 'Serve la stampa del colore bianco?', a: 'Sì, il bianco è fondamentale per gli adesivi resinati. Poiché la resina è trasparente, senza una base bianca i colori risulterebbero sbiaditi o trasparenti. La stampa del bianco garantisce colori vividi e brillanti sotto la cupola di resina.' },
			{ q: 'Quanto resiste all\'esterno?', a: 'Gli adesivi resinati sono estremamente resistenti alle condizioni esterne. La resina protegge dai raggi UV, dall\'acqua, dagli agenti atmosferici e dall\'usura meccanica. In condizioni normali, mantengono il loro aspetto per diversi anni anche in ambienti esterni.' },
			{ q: 'Come viene protetto l\'adesivo?', a: 'L\'adesivo viene protetto da una cupola di resina poliuretanica trasparente applicata con precisione tramite macchine CNC. Questa cupola crea una barriera fisica che protegge la stampa sottostante da graffi, umidità, raggi UV e agenti chimici.' },
			{ q: 'Che tipo di resina utilizzate?', a: 'Utilizziamo resina poliuretanica di alta qualità, specifica per applicazioni su adesivi. È una resina bicomponente che, una volta indurita, diventa trasparente, lucida e flessibile. Non ingiallisce nel tempo e mantiene la sua brillantezza per anni.' },
		],
		faqTitle: 'Domande frequenti sugli Adesivi resinati',
		engineProduct: 'resinati', cta: 'i tuoi Adesivi resinati',
		care: { title: 'Prima volta con', hl: 'Adesivi Resinati?', intro: 'La resina valorizza il design, ma va gestita con precisione. Per questo controlliamo tutto, prima di stampare.', checks: ['Controllo del file e delle aree di colata', 'Verifica e sistemazione sagoma e angoli', 'Prova visiva dell’effetto bombato prima della produzione', 'Ti mostriamo esattamente il risultato finale', 'Andiamo in stampa solo dopo il tuo ok'], closing: 'Nessuna sorpresa. Solo adesivi fatti come si deve.' },
		reviewsTitle: 'Spoiler:', reviewsHl: 'l’effetto 3D convince davvero', reviewsSub: 'Ordini reali. Risultati concreti.'
	},
	adesivi_rilievo: {
		slug: 'adesivi_rilievo', route: '/adesivi-rilievo', name: 'Adesivi in rilievo', title: 'Adesivi in rilievo',
		sub: 'Rilievo selettivo. Il dettaglio prende spessore.',
		desc: 'Vernice spot applicata solo dove serve. Alcuni dettagli prendono rilievo, altri restano piatti. Il risultato? un adesivo che si guarda e si sente.',
		checks: ['Prova di stampa gratuita', 'Spedizione veloce: pronti per la spedizione il {ship}', 'Stampiamo solo se viene bene', 'Nessuna sorpresa sul risultato', 'Effetto rilievo applicato con precisione'],
		cosa: 'Adesivi in rilievo. Dettagli che emergono. Risultati incredibili. Effetto rilievo applicato solo su parti specifiche della grafica. Alcuni elementi restano piatti, altri prendono profondità. Il risultato è un adesivo che non solo si vede, ma si percepisce al tatto.',
		gallery: ['/images/prodotti/rilievo/1.webp', '/images/prodotti/rilievo/10.webp', '/images/prodotti/rilievo/2.webp', '/images/prodotti/rilievo/3.webp', '/images/prodotti/rilievo/4.webp', '/images/prodotti/rilievo/5.webp', '/images/prodotti/rilievo/6.webp', '/images/prodotti/rilievo/7.webp', '/images/prodotti/rilievo/8.webp', '/images/prodotti/rilievo/9.webp', '/images/prodotti/rilievo/SP1.webp', '/images/prodotti/rilievo/SP2.webp', '/images/prodotti/rilievo/SP3.webp'],
		others: ['/images/prodotti/rilievo/1.webp', '/images/prodotti/rilievo/10.webp', '/images/prodotti/rilievo/2.webp'],
		faq: [
			{ q: 'Gli Adesivi in rilievo hanno lamina protettiva?', a: 'Sì, gli adesivi in rilievo vengono protetti con una lamina trasparente che preserva sia la stampa che l\'effetto rilievo. La lamina garantisce resistenza a graffi, raggi UV e agenti atmosferici, mantenendo intatto l\'effetto tridimensionale nel tempo.' },
			{ q: 'Serve la stampa del colore bianco?', a: 'In genere no. I nostri adesivi in rilievo vengono stampati su vinile bianco, quindi il bianco è già presente come base. Il colore bianco in stampa serve solo se hai bisogno di un bianco coprente su materiali trasparenti o colorati.' },
			{ q: 'Quanto resiste all\'esterno?', a: 'Gli adesivi in rilievo sono realizzati con materiali di alta qualità e lamina protettiva. Resistono perfettamente a pioggia, sole, vento e freddo. L\'effetto rilievo mantiene la sua consistenza e i colori restano brillanti per diversi anni anche in ambienti esterni.' },
			{ q: 'Dove è meglio mettere l\'effetto rilievo?', a: 'L\'effetto rilievo rende al meglio su dettagli specifici del design: loghi, scritte, bordi o elementi grafici che vuoi far risaltare. Non è consigliato applicarlo su tutta la superficie, ma solo sulle parti che vuoi evidenziare. Il contrasto tra zone piatte e zone in rilievo crea l\'effetto wow.' },
			{ q: 'Cosa vuol dire effetto lucido ed opaco?', a: 'L\'effetto rilievo può essere applicato con finitura lucida o opaca. Il lucido crea un effetto brillante e riflettente sulle zone in rilievo, mentre l\'opaco dona un aspetto più elegante e satinato. La scelta dipende dal risultato estetico che vuoi ottenere.' },
		],
		faqTitle: 'Domande frequenti sugli Adesivi in rilievo',
		engineProduct: 'sticker', cta: 'i tuoi Adesivi in rilievo',
		care: { title: 'Rilievo preciso.', hl: 'Nessuna sorpresa.', intro: 'Il rilievo è applicato solo dove conta. Così il risultato è esattamente quello che ti aspetti.', checks: ['Controlliamo il file e le aree indicate per il rilievo', 'Sistemiamo eventuali dettagli tecnici', 'Applichiamo lo spot solo dove richiesto', 'Ti mostriamo il risultato finale prima della stampa', 'Andiamo in stampa solo dopo il tuo ok'], closing: 'Risultato: un effetto rilievo preciso, coerente con il design. Niente esperimenti. Niente sorprese.' },
		reviewsTitle: 'Spoiler:', reviewsHl: 'il rilievo fa la differenza.', reviewsSub: 'Ordini reali. Risultati concreti.'
	},
	etichette: {
		slug: 'etichette', route: '/etichette', name: 'Etichette in fogli', title: 'Etichette in fogli',
		sub: 'Ordine, velocità, risultato pulito.',
		desc: 'Più etichette su un unico foglio, pronte da applicare. Ideali per packaging, prodotti e spedizioni. Quando servono praticità e qualità, insieme.',
		checks: ['Più etichette su un unico foglio', 'Stacco facile, applicazione manuale rapida', 'Materiali resistenti ad acqua, olio e uso quotidiano', 'Finitura protettiva per una resa pulita', 'Prova di stampa gratuita'],
		cosa: 'Etichette adesive disposte su foglio, pensate per essere applicate a mano in modo rapido e preciso. Resistenti, leggibili, affidabili. Quando il packaging deve essere all\'altezza del contenuto.',
		gallery: ['/images/prodotti/etichette/1.webp', '/images/prodotti/etichette/2.webp', '/images/prodotti/etichette/3.webp', '/images/prodotti/etichette/4.webp', '/images/prodotti/etichette/5.webp'],
		others: ['/images/prodotti/etichette/other-2.webp', '/images/prodotti/etichette/other-3.webp', '/images/prodotti/etichette/other-4.webp'],
		faq: [
			{ q: 'Le etichette hanno lamina protettiva?', a: 'Sì, tutte le nostre etichette in fogli vengono rivestite con una lamina protettiva trasparente che le rende resistenti a graffi, acqua, olio e uso quotidiano. La lamina garantisce una resa pulita e duratura nel tempo.' },
			{ q: 'Serve la stampa del colore bianco?', a: 'In genere no. Le etichette vengono stampate su vinile bianco, quindi il bianco è già presente come base. Il colore bianco in stampa serve solo se hai bisogno di un bianco coprente su materiali trasparenti o colorati.' },
			{ q: 'Quanto resiste all\'esterno?', a: 'Le nostre etichette in fogli sono realizzate con materiali di alta qualità e lamina protettiva. Resistono ad acqua, olio, cibo e uso quotidiano. Sono pensate principalmente per applicazioni su packaging, prodotti e spedizioni, e mantengono la loro qualità nel tempo.' },
			{ q: 'Come sono disposte le etichette sul foglio?', a: 'Le etichette vengono disposte su fogli comodi da usare, ottimizzando lo spazio per garantire il massimo numero di etichette per foglio. Sono pre-tagliate e facili da staccare, pronte per essere applicate a mano in modo rapido e preciso.' },
			{ q: 'Posso scegliere la forma delle etichette?', a: 'Assolutamente sì. Offriamo etichette tonde, quadrate, rettangolari, ovali e sagomate. Il taglio segue perfettamente il contorno del tuo design con tecnologia avanzata, garantendo precisione al millimetro.' },
		],
		faqTitle: 'Domande frequenti sulle Etichette in fogli',
		engineProduct: 'sticker', cta: 'le tue Etichette in fogli',
		care: { title: 'Zero stress.', hl: 'Anche quando etichetti tanto.', intro: 'Tu pensi al prodotto. Noi alle etichette. Che siano per vendita, spedizione o magazzino, le etichette devono funzionare subito. Per questo controlliamo tutto prima di andare in stampa.', checks: ['Controllo file e dimensioni', 'Verifica del taglio e della disposizione sul foglio', 'Prova di stampa da approvare', 'Nessuna produzione senza conferma', 'Nessuna sorpresa in applicazione'], closing: '' },
		reviewsTitle: 'Spoiler:', reviewsHl: 'fanno risparmiare tempo.', reviewsSub: 'E quando etichetti tanto, fa la differenza.'
	},
	fogli_adesivi: {
		slug: 'fogli_adesivi', route: '/fogli', name: 'Fogli di adesivi', title: 'Fogli di adesivi',
		sub: 'Il modo più smart per creare kit, set e collezioni.',
		desc: 'Inserisci più adesivi, anche diversi tra loro, in un unico foglio. Li disponi tu o lo facciamo noi per te. Ideali per merch, eventi, packaging e kit pronti all\'uso.',
		checks: ['Prova di stampa gratuita', 'Spedizione veloce: pronti per la spedizione il {ship}', 'Mezzo taglio su ogni adesivo (si staccano facile)', 'Più sagome diverse nello stesso foglio', 'Stampiamo solo se viene bene'],
		cosa: 'Fogli di adesivi personalizzati con più grafiche nello stesso layout. Ogni adesivo è tagliato singolarmente, ma resta sul foglio. Perfetti quando vuoi varietà, ordine e un risultato professionale.',
		gallery: ['/images/prodotti/fogli/1.webp', '/images/prodotti/fogli/2.webp', '/images/prodotti/fogli/3.webp'],
		others: ['/images/prodotti/fogli/other-2.webp', '/images/prodotti/fogli/other-3.webp', '/images/prodotti/fogli/other-4.webp'],
		faq: [
			{ q: 'Quanti adesivi diversi posso mettere su un foglio?', a: 'Puoi inserire quanti adesivi diversi vuoi sullo stesso foglio, anche con grafiche differenti tra loro. Noi li disponiamo nel layout ottimale oppure puoi indicarci tu la disposizione che preferisci.' },
			{ q: 'Serve la stampa del colore bianco?', a: 'In genere no. I fogli di adesivi vengono stampati su vinile bianco, quindi il bianco è già presente come base. Il colore bianco in stampa serve solo se hai bisogno di un bianco coprente su materiali trasparenti o colorati.' },
			{ q: 'Quanto resiste all\'esterno?', a: 'Le nostre etichette in fogli sono realizzate con materiali di alta qualità e lamina protettiva. Resistono ad acqua, olio, cibo e uso quotidiano. Sono pensate principalmente per applicazioni su packaging, prodotti e spedizioni, e mantengono la loro qualità nel tempo.' },
			{ q: 'Come funziona il mezzo taglio?', a: 'Il mezzo taglio (kiss-cut) taglia solo l\'adesivo senza attraversare il foglio di supporto. In questo modo ogni adesivo si stacca facilmente dal foglio, pronto per essere applicato. È la soluzione ideale per kit, set e collezioni.' },
			{ q: 'Posso avere sagome diverse sullo stesso foglio?', a: 'Assolutamente sì. Puoi combinare adesivi tondi, quadrati, rettangolari, ovali e sagomati sullo stesso foglio. Ogni adesivo avrà il suo mezzo taglio personalizzato, permettendoti di creare set e collezioni su misura.' },
		],
		faqTitle: 'Domande frequenti sui Fogli di adesivi',
		engineProduct: 'sticker', cta: 'i tuoi Fogli di adesivi',
		care: { title: 'Ogni adesivo', hl: 'al posto giusto.', intro: 'Tu pensi al design. Al resto ci pensiamo noi, per davvero.', checks: ['Controllo file e margini di taglio', 'Verifica del mezzo taglio su ogni adesivo', 'Sistemiamo l’impaginazione se serve', 'Ti mandiamo una prova da approvare', 'Si stampa solo dopo il tuo ok'], closing: 'Nessuna sorpresa. Nessun foglio sprecato.' },
		reviewsTitle: 'Spoiler:', reviewsHl: 'ordini reali, utilizzo reale.', reviewsSub: 'Opinioni vere.'
	},
	vetrofanie: {
		slug: 'vetrofanie', route: '/vetrofanie', name: 'Vetrofanie', title: 'Vetrofanie',
		sub: 'Visibili fuori. Perfette dentro.',
		desc: 'Adesivi pensati per essere applicati all\'interno del vetro e letti perfettamente dall\'esterno. Pulite, professionali, fatte per durare su vetrine, uffici e spazi commerciali.',
		checks: ['Applicazione interna, lettura esterna perfetta', 'Vinile resistente, colori nitidi', 'Taglio preciso su misura', 'Prova di stampa gratuita', 'Stampiamo solo se viene bene'],
		cosa: 'Vetrofanie in vinile con collante frontale, progettate per essere applicate all\'interno di vetrine e finestre. Protezione nel tempo, resa pulita, comunicazione chiara e professionale. Quando il messaggio deve durare quanto il tuo business.',
		gallery: ['/images/prodotti/vetrofanie/1.webp', '/images/prodotti/vetrofanie/2.webp', '/images/prodotti/vetrofanie/3.webp', '/images/prodotti/vetrofanie/4.webp'],
		others: ['/images/prodotti/vetrofanie/1.webp', '/images/prodotti/vetrofanie/2.webp', '/images/prodotti/vetrofanie/3.webp'],
		faq: [
			{ q: 'Le vetrofanie hanno lamina protettiva?', a: 'Sì, le nostre vetrofanie sono protette con una lamina trasparente che garantisce resistenza a graffi e raggi UV. La protezione mantiene i colori vividi e la leggibilità nel tempo, anche con esposizione diretta alla luce.' },
			{ q: 'Serve la stampa del colore bianco?', a: 'Sì, per le vetrofanie il bianco è fondamentale. Essendo applicate dall\'interno del vetro e lette dall\'esterno, la stampa del bianco garantisce che i colori siano coprenti e visibili attraverso il vetro. Senza il bianco, la vetrofania risulterebbe trasparente.' },
			{ q: 'Quanto resiste all\'esterno?', a: 'Le vetrofanie sono progettate per durare. Essendo applicate all\'interno del vetro, sono protette dagli agenti atmosferici esterni. Il vinile e la lamina garantiscono resistenza ai raggi UV e mantengono colori nitidi per diversi anni.' },
			{ q: 'Come si applicano le vetrofanie?', a: 'Le vetrofanie si applicano dall\'interno del vetro, con il collante rivolto verso la superficie. Si leggono perfettamente dall\'esterno grazie alla stampa speculare. L\'applicazione è semplice: basta pulire il vetro, posizionare la vetrofania e premere per eliminare le bolle d\'aria.' },
			{ q: 'Posso usarle su qualsiasi vetro?', a: 'Sì, le vetrofanie si applicano su qualsiasi superficie vetrata liscia: vetrine di negozi, finestre di uffici, porte a vetri, auto e molto altro. Il collante è studiato per aderire perfettamente al vetro senza lasciare residui alla rimozione.' },
		],
		faqTitle: 'Domande frequenti sulle Vetrofanie',
		engineProduct: 'sticker', cta: 'le tue Vetrofanie',
		care: { title: 'Zero stress.', hl: 'Anche su vetro.', intro: 'Tu carichi il file. Noi pensiamo al resto. Le vetrofanie sembrano semplici, ma richiedono attenzione su orientamento, bordi e resa finale. Per questo controlliamo tutto prima di stampare.', checks: ['Controllo orientamento e specularità', 'Verifica bordi e taglio per applicazione su vetro', 'Prova di stampa da approvare', 'Nessuna stampa senza il tuo ok', 'Nessuna sorpresa sul risultato'], closing: '' },
		reviewsTitle: 'Spoiler:', reviewsHl: 'si notano. Eccome.', reviewsSub: 'Vetrine reali. Feedback reali.'
	},
};
