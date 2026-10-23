# Spedizioni estere: listino FedEx e tariffe al cliente

Listino FedEx del 22/10/2026 (proposta 17005681, Stickerprint S.R.L.S., codice cliente 204736711), copia in `~/Desktop/CLAUDE/spedizioni/`.
Servizio usato per l'e-commerce: **FedEx International Connect Plus** (export dall'Italia). Tariffe NETTE in euro, fino a 5 kg per collo,
senza supplemento carburante, dogana e accessori (le nette "non includono supplementi, spese accessorie, tasse e oneri doganali").

| Zona FedEx | Paesi | Netta 0,5-5 kg | Al cliente (IVA incl.) |
|---|---|---|---|
| R | Austria, Germania, Francia, Slovenia | 7,50 € | 11,90 € |
| S | Belgio, Spagna, Lussemburgo, Olanda, Portogallo | 7,63 € | 11,90 € |
| T | Bulgaria, Rep. Ceca, Ungheria, Polonia, Romania, Slovacchia | 9,18 € | 14,90 € |
| U | Croazia, Danimarca, Estonia, Finlandia, Grecia, Irlanda, Lettonia, Lituania, Svezia | 10,99 € | 14,90 € |
| V | Cipro, Malta | 19,98 € | 24,90 € |
| H | Stati Uniti (tutto il paese) | 15,79 € a 0,5 kg · 15,92 € a 1 kg · 18,02 € a 1,5 kg · 20,13 € a 2 kg · 30,90 € a 5 kg | 24,90 $ (niente IVA) |
| D | Puerto Rico | 23,26 € a 0,5 kg | 34,90 $ |
| W / X | Svizzera 12,52 € / Regno Unito 10,47 € | | non serviti (fuori UE, dogana) |

Fasce di peso successive (5,5-10 kg): R 9,97 · S 10,29 · T 11,93 · U 15,48 · V 29,98 · USA da 34,13 € (5,5 kg) a 58,97 € (10 kg).
Soglie di spedizione gratuita: 69 € nell'UE, 99 $ negli USA (`LOCALES[].freeShipping` e `SPEDIZIONE[].gratisDa`).
Le cifre al cliente stanno in `src/lib/mercati.ts` (`SPEDIZIONE`, `TARIFFA_UE`); il calcolo in `src/lib/shipping-rules.ts`.

Da decidere con Mattia: il kit campioni da solo viaggia gratis anche all'estero (a noi costa 7,50-20 €); negli USA i dazi
sono a carico del destinatario alla consegna (DAP), FedEx offre il DDP con supplemento.
