/** Argomenti di aiuto (testi ripresi da stickerprint.it/support) */
export interface SupportTopic { title: string; faqs: { q: string; a: string }[] }
export const SUPPORT_TOPICS: SupportTopic[] = [
 {
  "title": "Materiali",
  "faqs": [
   {
    "q": "Che differenza c'è tra vinile monomerico e polimerico?",
    "a": "Il vinile monomerico è più economico e adatto per applicazioni a breve-medio termine (2-3 anni). Il vinile polimerico è più resistente, flessibile e durevole (5-7 anni), ideale per superfici curve e applicazioni esterne prolungate."
   },
   {
    "q": "Quale materiale è più adatto per uso esterno?",
    "a": "Per uso esterno consigliamo il vinile polimerico con laminazione protettiva. Resiste a pioggia, sole, gelo e raggi UV. Per la massima durata in condizioni estreme, gli adesivi resinati offrono una protezione ancora superiore grazie alla cupola di resina."
   },
   {
    "q": "Il materiale adesivo è rimovibile o permanente?",
    "a": "I nostri adesivi utilizzano un collante permanente di alta qualità. Una volta applicati, aderiscono saldamente alla superficie. Possono essere rimossi con l'aiuto di un phon o di prodotti specifici, ma non sono pensati per essere riposizionati più volte."
   },
   {
    "q": "Su quali superfici posso applicare gli adesivi?",
    "a": "Gli adesivi aderiscono su superfici lisce e pulite come vetro, metallo, plastica rigida, legno laccato e carrozzeria auto. Non sono adatti per superfici porose (muri grezzi, tessuti) o fortemente irregolari. La superficie deve essere pulita e asciutta per una perfetta adesione."
   },
   {
    "q": "Come devo preparare la superficie prima di applicare l'adesivo?",
    "a": "La superficie deve essere pulita, asciutta e priva di polvere o grasso. Consigliamo di pulirla con alcool isopropilico o un detergente sgrassante e attendere che sia completamente asciutta. Evita di toccare la superficie con le dita dopo la pulizia per non lasciare residui di unto."
   },
   {
    "q": "I materiali sono certificati e sicuri?",
    "a": "Sì, tutti i nostri materiali sono conformi alle normative europee e privi di sostanze nocive. I vinili utilizzati sono certificati per uso indoor e outdoor. Per applicazioni specifiche come il settore alimentare, offriamo materiali certificati per contatto indiretto con alimenti."
   }
  ]
 },
 {
  "title": "Protezioni e finiture",
  "faqs": [
   {
    "q": "Che differenza c'è tra laminazione lucida e opaca?",
    "a": "La laminazione lucida dona un aspetto brillante e vivace ai colori, ideale per grafiche fotografiche e colori accesi. La laminazione opaca offre un effetto più elegante e satinato, riduce i riflessi e conferisce un look professionale e moderno."
   },
   {
    "q": "La laminazione è necessaria?",
    "a": "La laminazione protettiva è fortemente consigliata perché protegge la stampa da graffi, raggi UV, acqua e usura quotidiana. Senza laminazione, i colori possono sbiadire più rapidamente e la stampa è più vulnerabile ai danni. Tutti i nostri prodotti includono la laminazione protettiva."
   },
   {
    "q": "Cos'è la finitura in rilievo e come funziona?",
    "a": "La finitura in rilievo è un effetto tridimensionale che viene applicato su zone specifiche del design tramite verniciatura UV selettiva. Puoi scegliere tra effetto lucido o opaco. L'effetto rilievo dona un tocco tattile premium al tuo adesivo, evidenziando loghi, scritte o dettagli grafici."
   },
   {
    "q": "Cosa significa base di bianco nella stampa?",
    "a": "La base di bianco è uno strato di inchiostro bianco stampato sotto la grafica. Serve a rendere i colori più coprenti e vividi, specialmente su materiali trasparenti o per vetrofanie. Per adesivi su vinile bianco non è generalmente necessaria, ma è fondamentale per vetrofanie e materiali trasparenti."
   },
   {
    "q": "Quale protezione scegliere per adesivi destinati ad ambienti umidi?",
    "a": "Per ambienti umidi come bagni, cucine o esterni esposti alla pioggia, consigliamo la laminazione lucida che offre una barriera impermeabile più efficace. Per una resistenza ancora maggiore, gli adesivi resinati con la cupola di resina poliuretanica garantiscono una protezione totale dall'acqua."
   },
   {
    "q": "La laminazione cambia i colori della stampa?",
    "a": "La laminazione può influire leggermente sulla percezione dei colori. La laminazione lucida tende a rendere i colori più vivaci e saturi, mentre quella opaca li rende leggermente più morbidi e meno riflettenti. In entrambi i casi, la differenza è minima e il risultato è sempre professionale."
   }
  ]
 },
 {
  "title": "Adesivi Personalizzati",
  "faqs": [
   {
    "q": "Quali forme sono disponibili per gli adesivi personalizzati?",
    "a": "Offriamo adesivi personalizzati in cinque forme: rotondi, quadrati, rettangolari, ovali e sagomati. Con il taglio sagomato, l'adesivo segue esattamente il contorno del tuo design, per un risultato professionale e senza bordi bianchi."
   },
   {
    "q": "Qual è la dimensione minima e massima degli adesivi?",
    "a": "Le dimensioni variano in base alla forma scelta. In generale, la dimensione minima è di circa 10mm e la massima arriva fino a 300mm o oltre. Nel configuratore online troverai tutte le dimensioni disponibili per ciascuna forma."
   },
   {
    "q": "Posso ordinare quantità diverse per lo stesso design?",
    "a": "Ogni configurazione nel carrello corrisponde a un prodotto specifico con le sue impostazioni (forma, dimensione, materiale, quantità). Se hai bisogno dello stesso design in quantità diverse, puoi aggiungerlo più volte al carrello con configurazioni diverse."
   },
   {
    "q": "In che formato devo inviare il file grafico?",
    "a": "Accettiamo file in formato PDF, AI, EPS, SVG, PNG, JPG, JPEG e TIFF. Per il miglior risultato, consigliamo file vettoriali (PDF, AI, EPS, SVG) con colori in CMYK. Il peso massimo per file è 25MB."
   },
   {
    "q": "Come funziona il taglio sagomato?",
    "a": "Il taglio sagomato segue il contorno esatto del tuo design grazie a una macchina da taglio di precisione. L'adesivo risultante non ha bordi bianchi né forme standard: la sua forma ricalca perfettamente la tua grafica. È la scelta ideale per loghi, mascotte e design con forme irregolari."
   },
   {
    "q": "Posso richiedere un campione prima di ordinare una grande quantità?",
    "a": "Sì, puoi aggiungere un campione al carrello per testare materiale, colori e dimensioni prima di un ordine importante. Se lo aggiungi insieme ad altri prodotti, il campione è gratuito. Se lo ordini da solo, ha un costo di €10."
   }
  ]
 },
 {
  "title": "Adesivi Resinati",
  "faqs": [
   {
    "q": "Perché gli adesivi resinati costano di più rispetto agli altri?",
    "a": "Il costo maggiore è dovuto al processo di resinatura, che richiede l'applicazione manuale di resina poliuretanica bicomponente su ogni singolo adesivo tramite macchine CNC. Il risultato è un prodotto premium con effetto 3D, resistenza superiore e una durata che può raggiungere 7-10 anni."
   },
   {
    "q": "Posso avere adesivi resinati con angoli vivi?",
    "a": "No, gli adesivi resinati necessitano di angoli arrotondati per garantire una distribuzione uniforme della resina. Con angoli vivi, la resina non si distribuirebbe correttamente e il risultato sarebbe imperfetto. Per questo motivo le forme disponibili prevedono sempre un raggio minimo sugli angoli."
   },
   {
    "q": "Gli adesivi resinati sono adatti per applicazioni su auto e moto?",
    "a": "Assolutamente sì. La resina poliuretanica è estremamente resistente agli agenti atmosferici, ai lavaggi auto e alle vibrazioni. Gli adesivi resinati sono tra i più utilizzati nel settore automotive per loghi, badge e personalizzazioni su carrozzeria, cerchioni e caschi."
   },
   {
    "q": "Quanto tempo serve per la produzione di adesivi resinati?",
    "a": "Gli adesivi resinati richiedono tempi di produzione leggermente più lunghi rispetto agli adesivi standard, a causa del processo di resinatura e dei tempi di indurimento della resina. In media i tempi di produzione sono di 5-7 giorni lavorativi dall'approvazione della prova di stampa."
   },
   {
    "q": "La resina ingiallisce nel tempo?",
    "a": "No, la resina poliuretanica che utilizziamo è di alta qualità e formulata per non ingiallire. Mantiene la sua trasparenza e brillantezza anche dopo anni di esposizione a raggi UV e agenti atmosferici. È uno dei principali vantaggi della resina poliuretanica rispetto ad altri tipi di resina."
   }
  ]
 },
 {
  "title": "Adesivi in Rilievo",
  "faqs": [
   {
    "q": "Qual è la differenza tra adesivi in rilievo e adesivi resinati?",
    "a": "Gli adesivi in rilievo hanno un effetto tridimensionale ottenuto tramite verniciatura UV selettiva su zone specifiche del design. Gli adesivi resinati hanno invece una cupola di resina trasparente che ricopre l'intera superficie. Il rilievo è più sottile e selettivo, la resina è più spessa e copre tutto."
   },
   {
    "q": "Posso scegliere quali parti del design avranno il rilievo?",
    "a": "Sì, il rilievo viene applicato in modo selettivo. Puoi indicarci quali elementi del tuo design vuoi mettere in rilievo: loghi, testi, bordi o dettagli specifici. Il contrasto tra le zone piatte e quelle in rilievo crea un effetto visivo e tattile molto d'impatto."
   },
   {
    "q": "L'effetto rilievo si rovina nel tempo?",
    "a": "No, l'effetto rilievo è molto resistente grazie alla verniciatura UV che viene indurita con luce ultravioletta. Combinato con la laminazione protettiva, mantiene la sua consistenza e il suo aspetto per anni, anche in condizioni di uso intenso."
   },
   {
    "q": "Gli adesivi in rilievo sono adatti per uso esterno?",
    "a": "Sì, gli adesivi in rilievo sono perfettamente adatti per uso esterno. La verniciatura UV che crea l'effetto rilievo è resistente agli agenti atmosferici, e la laminazione protettiva aggiuntiva garantisce una durata di diversi anni anche esposti a pioggia, sole e gelo."
   },
   {
    "q": "Posso avere il rilievo sia lucido che opaco sullo stesso adesivo?",
    "a": "Attualmente offriamo la finitura in rilievo in una sola variante per adesivo: o tutta lucida o tutta opaca. Non è possibile combinare rilievo lucido e opaco sullo stesso pezzo. Puoi però ordinare lo stesso design in due versioni separate, una con rilievo lucido e una con opaco."
   },
   {
    "q": "Il rilievo si sente al tatto?",
    "a": "Sì, l'effetto rilievo è percepibile al tatto. Si crea uno spessore leggero ma evidente nelle zone trattate, che dona una sensazione premium e tridimensionale. Questo effetto tattile è uno dei principali punti di forza degli adesivi in rilievo, ideale per biglietti da visita, packaging di lusso e branding."
   }
  ]
 },
 {
  "title": "Etichette",
  "faqs": [
   {
    "q": "Come sono organizzate le etichette sui fogli?",
    "a": "Le etichette vengono disposte su fogli ottimizzando lo spazio, con pre-taglio (kiss-cut) che permette di staccarle facilmente una alla volta dal foglio di supporto. Ogni foglio è progettato per essere comodo da usare, sia per applicazione manuale che per piccole produzioni."
   },
   {
    "q": "Le etichette sono resistenti ad acqua e olio?",
    "a": "Sì, le nostre etichette sono stampate su vinile con laminazione protettiva che le rende resistenti ad acqua, olio, cibo e uso quotidiano. Sono ideali per prodotti cosmetici, alimentari, bevande e qualsiasi applicazione che richiede resistenza ai liquidi."
   },
   {
    "q": "Posso usare le etichette per i miei prodotti da vendere?",
    "a": "Certamente. Le nostre etichette sono perfette per branding di prodotti: bottiglie, barattoli, scatole, cosmetici, candele e molto altro. La qualità di stampa professionale e la resistenza dei materiali garantiscono un aspetto premium per i tuoi prodotti."
   },
   {
    "q": "Quante etichette ci sono in ogni foglio?",
    "a": "Il numero di etichette per foglio dipende dalla dimensione scelta. Nel configuratore vedrai automaticamente quanti pezzi contiene ogni foglio in base alle dimensioni selezionate. Più piccole sono le etichette, più ne entrano per foglio."
   },
   {
    "q": "Posso scegliere la disposizione delle etichette sul foglio?",
    "a": "Il nostro team ottimizza automaticamente la disposizione per garantire il massimo numero di etichette per foglio. Se hai esigenze particolari sulla disposizione, puoi indicarlo nelle note dell'ordine o contattarci e faremo il possibile per accontentarti."
   },
   {
    "q": "Le etichette sono adatte per bottiglie e barattoli curvi?",
    "a": "Sì, le nostre etichette sono realizzate in vinile flessibile che si adatta bene a superfici leggermente curve come bottiglie e barattoli. Per curve molto accentuate, consigliamo dimensioni contenute per evitare grinze. Il materiale polimerico offre la migliore flessibilità per queste applicazioni."
   }
  ]
 },
 {
  "title": "Vetrofanie",
  "faqs": [
   {
    "q": "Qual è la differenza tra applicazione interna ed esterna?",
    "a": "L'applicazione interna prevede che la vetrofania venga incollata all'interno del vetro e letta dall'esterno (stampa speculare). L'applicazione esterna si incolla direttamente sulla superficie esterna del vetro. L'applicazione interna è consigliata perché protegge la stampa dagli agenti atmosferici."
   },
   {
    "q": "Le vetrofanie bloccano completamente la luce?",
    "a": "Le vetrofanie standard coprono la parte stampata ma non bloccano completamente la luce. Le zone con colori chiari possono lasciare filtrare un po' di luminosità. Per un effetto coprente totale, la base di bianco garantisce opacità completa nelle zone stampate."
   },
   {
    "q": "Posso applicare le vetrofanie su plexiglass o superfici curve?",
    "a": "Le vetrofanie si applicano perfettamente su plexiglass e superfici trasparenti lisce. Per superfici leggermente curve funzionano bene, ma per curvature accentuate consigliamo dimensioni più piccole per evitare grinze. Non sono adatte per superfici opache o porose."
   },
   {
    "q": "Come rimuovo una vetrofania senza danneggiare il vetro?",
    "a": "Le nostre vetrofanie si rimuovono facilmente sollevando un angolo e tirando lentamente. Se l'adesivo è molto tenace, puoi usare un phon per scaldare leggermente la superficie e facilitare la rimozione. Eventuali residui si puliscono con un detergente per vetri."
   },
   {
    "q": "Le vetrofanie sono adatte per vetrine di negozi?",
    "a": "Assolutamente sì, le vetrofanie sono uno dei prodotti più richiesti per vetrine commerciali. Sono perfette per comunicare promozioni, orari, loghi e decorazioni. L'applicazione dall'interno protegge la stampa e permette di mantenere la vetrina pulita dall'esterno senza rischiare di rovinare la grafica."
   },
   {
    "q": "Posso ordinare vetrofanie con stampa fronte e retro?",
    "a": "Le vetrofanie vengono stampate su un solo lato con stampa speculare per applicazione dall'interno, oppure stampa normale per applicazione dall'esterno. Non è possibile stampare fronte e retro sullo stesso supporto, ma puoi ordinare due vetrofanie separate da applicare su entrambi i lati del vetro."
   }
  ]
 },
 {
  "title": "Fogli Adesivi",
  "faqs": [
   {
    "q": "Cosa sono i fogli adesivi e a cosa servono?",
    "a": "I fogli adesivi sono fogli con più adesivi disposti insieme, ognuno con il proprio mezzo taglio (kiss-cut). Sono perfetti per creare set, collezioni, kit promozionali o per chi ha bisogno di più grafiche diverse sullo stesso supporto. Ogni adesivo si stacca facilmente dal foglio."
   },
   {
    "q": "Posso inserire grafiche diverse sullo stesso foglio?",
    "a": "Sì, puoi inserire quanti adesivi diversi vuoi sullo stesso foglio, anche con grafiche e forme differenti tra loro. Puoi combinare adesivi tondi, quadrati, rettangolari e sagomati sullo stesso foglio. Il layout viene ottimizzato per sfruttare al meglio lo spazio."
   },
   {
    "q": "I fogli adesivi sono disponibili in verticale e orizzontale?",
    "a": "Sì, offriamo fogli adesivi in formato verticale, orizzontale e sagomato. Il formato sagomato permette di avere il foglio stesso tagliato su una forma personalizzata, non solo i singoli adesivi al suo interno."
   },
   {
    "q": "Come funziona il taglio sui fogli adesivi?",
    "a": "Ogni adesivo sul foglio ha un mezzo taglio (kiss-cut) che incide solo il vinile senza tagliare il foglio di supporto. In questo modo puoi staccare ogni singolo adesivo facilmente, mantenendo il foglio intatto come base. È la soluzione ideale per packaging e distribuzione."
   },
   {
    "q": "I fogli adesivi sono adatti come gadget promozionali?",
    "a": "Sì, i fogli adesivi sono perfetti come gadget promozionali, merchandising e omaggi. Puoi creare set tematici con il tuo brand, inserire più soggetti diversi sullo stesso foglio e distribuirli a eventi, fiere o come inserti negli ordini. Il formato foglio è pratico e ha un grande impatto visivo."
   },
   {
    "q": "Qual è la dimensione massima di un foglio adesivo?",
    "a": "Le dimensioni dei fogli variano in base al formato scelto (verticale, orizzontale o sagomato). Nel configuratore puoi selezionare tra le dimensioni disponibili. Per esigenze fuori standard o dimensioni particolarmente grandi, contatta il servizio clienti per valutare la fattibilità."
   }
  ]
 },
 {
  "title": "Ordini e spedizioni",
  "faqs": [
   {
    "q": "Quali sono i tempi di produzione e consegna?",
    "a": "I tempi di produzione standard sono di 3-5 giorni lavorativi dalla approvazione della prova di stampa. La spedizione standard impiega ulteriori 2-4 giorni lavorativi. È disponibile anche la spedizione express per consegne più rapide con un supplemento del 30%."
   },
   {
    "q": "Come posso tracciare il mio ordine?",
    "a": "Riceverai un'email con il codice di tracciamento non appena l'ordine viene spedito. Puoi monitorare lo stato della spedizione in tempo reale dalla sezione \"I miei ordini\" del tuo account, dove troverai il link diretto al tracking del corriere."
   },
   {
    "q": "Cosa succede dopo che effettuo un ordine?",
    "a": "Dopo l'ordine riceverai un'email di conferma. Il nostro team preparerà una prova di stampa digitale che ti verrà inviata via email per approvazione. Una volta approvata la prova e confermato il pagamento, l'ordine entra in produzione."
   },
   {
    "q": "Cos'è la prova di stampa e come funziona?",
    "a": "La prova di stampa è un'anteprima digitale del tuo adesivo nelle dimensioni reali. Ti verrà inviata via email con un link per approvarla o richiedere modifiche. Il pagamento viene elaborato automaticamente al momento dell'approvazione. Se richiedi modifiche, riceverai una nuova prova aggiornata."
   },
   {
    "q": "Con quali corrieri spedite?",
    "a": "Ci affidiamo ai principali corrieri nazionali per garantire consegne rapide e sicure in tutta Italia. Il corriere viene assegnato in base alla zona di destinazione e alla tipologia di spedizione scelta (standard o express)."
   },
   {
    "q": "Cosa succede se non sono a casa al momento della consegna?",
    "a": "Il corriere lascerà un avviso di passaggio e tenterà una seconda consegna il giorno lavorativo successivo. In alternativa, potrai contattare il corriere tramite il link di tracking ricevuto via email per riprogrammare la consegna o ritirare il pacco presso il punto di ritiro più vicino."
   }
  ]
 },
 {
  "title": "Resi e rimborsi",
  "faqs": [
   {
    "q": "Posso restituire un prodotto personalizzato?",
    "a": "I prodotti personalizzati possono essere restituiti solo in caso di difetti di produzione o errori da parte nostra. Trattandosi di articoli realizzati su misura, non è possibile il reso per ripensamento. Accettiamo reclami entro 14 giorni dalla consegna con documentazione fotografica del difetto."
   },
   {
    "q": "Come funziona il processo di rimborso?",
    "a": "Una volta verificato e approvato il reclamo, il rimborso viene elaborato entro 3-5 giorni lavorativi sullo stesso metodo di pagamento utilizzato per l'acquisto. Per pagamenti con carta di credito, il rimborso potrebbe richiedere ulteriori giorni per apparire sull'estratto conto."
   },
   {
    "q": "Cosa faccio se il prodotto arriva danneggiato?",
    "a": "Se il prodotto arriva danneggiato durante il trasporto, contattaci entro 48 ore dalla consegna inviando foto del pacco e del prodotto danneggiato. Provvederemo alla rispedizione gratuita o al rimborso completo a seconda della tua preferenza."
   },
   {
    "q": "Se la prova di stampa non mi piace, posso annullare l'ordine?",
    "a": "Sì, finché non approvi la prova di stampa puoi richiedere modifiche senza costi aggiuntivi. Se dopo le revisioni non sei soddisfatto, contatta il servizio clienti per discutere le opzioni disponibili. Il pagamento viene elaborato solo al momento dell'approvazione della prova."
   },
   {
    "q": "Quante revisioni della prova di stampa posso richiedere?",
    "a": "Non c'è un limite fisso al numero di revisioni. Puoi richiedere le modifiche necessarie finché la prova non ti soddisfa pienamente. Il nostro obiettivo è che tu sia completamente soddisfatto del risultato prima di procedere con la stampa."
   },
   {
    "q": "Posso richiedere la fattura per il mio ordine?",
    "a": "Sì, durante il checkout puoi inserire i dati di fatturazione (ragione sociale, partita IVA, codice SDI). La fattura verrà emessa automaticamente e inviata all'indirizzo email indicato. Se hai bisogno di una fattura per un ordine già effettuato, contatta il servizio clienti."
   }
  ]
 },
 {
  "title": "Domande generali",
  "faqs": [
   {
    "q": "Offrite sconti per grandi quantità?",
    "a": "Sì, il nostro sistema calcola automaticamente sconti progressivi in base alla quantità ordinata. Più adesivi ordini, più basso sarà il prezzo unitario. Per quantità molto elevate o esigenze particolari, contattaci per un preventivo personalizzato."
   },
   {
    "q": "Posso ordinare dei campioni prima di fare un ordine grande?",
    "a": "Sì, offriamo la possibilità di ordinare campioni. Se aggiungi un campione insieme ad altri prodotti nel carrello, il campione è gratuito. Se ordini solo il campione, il costo è di €10. È il modo migliore per verificare la qualità prima di un ordine importante."
   },
   {
    "q": "Quali metodi di pagamento accettate?",
    "a": "Accettiamo pagamenti con carta di credito/debito (Visa, Mastercard, American Express) tramite Stripe e PayPal. Il pagamento con carta viene elaborato in modo sicuro al momento dell'approvazione della prova di stampa."
   },
   {
    "q": "Posso riordinare lo stesso prodotto senza riconfigurarlo?",
    "a": "Sì, nella sezione \"Riordini\" del tuo account trovi lo storico degli ordini precedenti con la possibilità di riordinare rapidamente lo stesso prodotto con le stesse specifiche, risparmiando tempo nella configurazione."
   },
   {
    "q": "Devo creare un account per ordinare?",
    "a": "No, puoi effettuare ordini anche come ospite senza creare un account. Tuttavia, registrandoti avrai accesso allo storico ordini, al tracciamento delle spedizioni, ai riordini rapidi e alla gestione dei tuoi indirizzi e metodi di pagamento salvati."
   },
   {
    "q": "Come posso contattare il servizio clienti?",
    "a": "Puoi contattarci tramite il form nella sezione \"Mandaci un'email\" di questa pagina. Il nostro team risponde generalmente entro 24 ore lavorative. Per richieste urgenti, indica nell'oggetto la parola \"URGENTE\" e daremo priorità alla tua richiesta."
   }
  ]
 }
];
