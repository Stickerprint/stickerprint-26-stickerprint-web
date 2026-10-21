/** Testi prodotto in lingua "fr" (francese di Francia, vous). Stesse chiavi di testiIt: vedi docs/traduzioni.md (tono, glossario). */
import type { TestiLingua } from './it';

export const testiFr: TestiLingua = {
	prodotti: {
		adesivi_personalizzati: {
			name: 'Stickers personnalisés', title: 'Stickers personnalisés', h1: ['Stickers', 'personnalisés'],
			seoTitle: 'Stickers personnalisés en ligne avec aperçu immédiat | Stickerprint',
			seoDesc: 'Stickers personnalisés en vinyle, découpés à la forme, mats ou brillants. Chargez votre fichier, voyez l’aperçu tout de suite et commandez dès 15 pièces.',
			seoCategory: 'Stickers personnalisés',
			sub: 'Bien faits. Point.',
			desc: 'Matériaux premium. Impression haute qualité. Découpe précise. Vous chargez le fichier, on s’occupe du reste.',
			checks: ['Aperçu automatique immédiat', 'Livraison estimée {ship} · gratuite dès {soglia}', 'On n’imprime que si c’est réussi', 'Aucune surprise sur le résultat'],
			cosa: 'Des stickers découpés sur mesure et imprimés pour durer. Couleurs pleines, détails nets, des matériaux qui résistent à l’usage, au temps et aux envois. Vous les collez, vous les expédiez, vous les faites circuler. Et ils font leur travail. Longtemps.',
			faq: [
				{ q: 'Que veut dire découpe à la forme ?', a: 'La découpe à la forme suit exactement le contour de votre design, sans bord blanc rectangulaire. Le sticker est découpé sur mesure par une machine de précision qui suit la forme de votre fichier, pour un résultat net et professionnel.' },
				{ q: 'Faut-il imprimer le blanc ?', a: 'En général non. Nos stickers personnalisés sont imprimés sur vinyle blanc, le blanc est donc déjà présent comme base. L’impression du blanc ne sert que si vous avez besoin d’un blanc couvrant sur des supports transparents ou colorés.' },
				{ q: 'Quelle est la tenue en extérieur ?', a: 'Nos stickers personnalisés sont réalisés en vinyle haute qualité avec une lamination de protection. Ils résistent à la pluie, au soleil, au vent et au froid. Dans des conditions normales, ils gardent des couleurs éclatantes et une bonne adhérence pendant plusieurs années, même en extérieur.' },
				{ q: 'Comment le sticker est-il protégé ?', a: 'Chaque sticker est recouvert d’une lamination transparente qui le protège des rayures, des UV, de l’humidité et de l’usure quotidienne. Cette protection garde les couleurs vives et la surface intacte dans le temps.' },
			],
			faqTitle: 'Questions fréquentes sur les stickers personnalisés',
			cta: 'vos stickers personnalisés',
			compare: {
				titlePre: 'Tous les stickers ne sont pas faits pour', titleHl: 'durer.', hl: 'blue',
				sub: 'Certains économisent sur les matériaux. Nous préférons ne pas économiser sur votre résultat.',
				usHead: 'Stickers Stickerprint', themHead: 'Stickers bon marché',
				rows: [
					{ icon: 'layers', label: 'Matériaux', us: 'Vinyles premium sélectionnés', them: 'Matériaux bon marché' },
					{ icon: 'print', label: 'Impression', us: 'Ne se décolore pas, même sans lamination', them: 'Délavés au bout de quelques jours' },
					{ icon: 'shield', label: 'Protection', us: 'Lamination de protection en option', them: 'Absente et indisponible' },
					{ icon: 'cut', label: 'Découpe', us: 'Précise, même sur forme personnalisée', them: 'Formats plutôt standardisés' },
					{ icon: 'sliders', label: 'Personnalisation', us: 'Dimensions, finitions et matériaux au choix', them: 'Formats standard, matériaux standard' },
					{ icon: 'people', label: 'Expérience', us: '19 ans d’expérience dans l’impression', them: 'Pas toujours annoncée' }
				],
				closing: 'Un sticker bon marché coûte moins cher une fois. Un sticker bien fait vaut plus chaque jour.',
				cta: 'Créez vos stickers →', href: '#preventivatore'
			},
			care: { title: 'Zéro stress.', hl: 'On s’en occupe.', intro: 'C’est votre première commande ? Pas d’inquiétude. Voici la checklist que nous appliquons à chaque commande :', checks: ['Contrôle manuel de chaque fichier', 'Si besoin, on corrige le fichier avant d’imprimer', 'Aperçu automatique du résultat avant de payer', 'Vous voyez exactement comment nous réaliserons votre produit', 'On imprime ce que vous avez vu, sans surprise'], closing: '' },
			reviewsTitle: 'Ce qu’on dit de', reviewsHl: 'ces stickers.', reviewsSub: 'Commandes réelles. Résultats concrets.'
		},
		adesivi_resinati: {
			name: 'Stickers résinés', title: 'Stickers résinés',
			seoTitle: 'Stickers résinés 3D personnalisés (doming) | Stickerprint',
			seoDesc: 'Stickers résinés avec dôme 3D : effet bombé, couleurs profondes et résine protectrice. Ronds, carrés, ovales ou découpés à la forme, avec aperçu immédiat.',
			seoCategory: 'Stickers résinés',
			sub: 'Du vrai relief. Effet premium garanti.',
			desc: 'Finition bombée, brillante et en trois dimensions. Quand le design ne doit pas seulement se voir. Il doit se faire remarquer.',
			checks: ['Résine premium ultra brillante', 'Aperçu automatique immédiat', 'Livraison estimée {ship} · gratuite dès {soglia}', 'On n’imprime que si c’est réussi', 'Aucune surprise sur le résultat'],
			cosa: 'Stickers résinés. Un effet premium qui se voit au premier coup d’œil. Finition bombée 3D, couleurs plus profondes et une résine qui protège et met en valeur le design. Quand le sticker ne doit pas seulement coller, mais se démarquer.',
			faq: [
				{ q: 'Pourquoi faut-il des angles arrondis ?', a: 'Les angles arrondis sont nécessaires pour que la résine se répartisse parfaitement. Avec des angles vifs, la résine a tendance à ne pas se distribuer uniformément et peut créer des défauts. Les angles arrondis assurent une couverture homogène et un résultat impeccable.' },
				{ q: 'Faut-il imprimer le blanc ?', a: 'Oui, le blanc est indispensable pour les stickers résinés. Comme la résine est transparente, sans base blanche les couleurs paraîtraient délavées ou transparentes. L’impression du blanc garantit des couleurs vives et éclatantes sous le dôme de résine.' },
				{ q: 'Quelle est la tenue en extérieur ?', a: 'Les stickers résinés sont extrêmement résistants aux conditions extérieures. La résine protège des UV, de l’eau, des intempéries et de l’usure mécanique. Dans des conditions normales, ils gardent leur aspect pendant plusieurs années, même en extérieur.' },
				{ q: 'Comment le sticker est-il protégé ?', a: 'Le sticker est protégé par un dôme de résine polyuréthane transparente, appliqué avec précision par des machines CNC. Ce dôme forme une barrière physique qui protège l’impression des rayures, de l’humidité, des UV et des agents chimiques.' },
				{ q: 'Quel type de résine utilisez-vous ?', a: 'Nous utilisons une résine polyuréthane de haute qualité, conçue pour les stickers. C’est une résine bi-composant qui, une fois durcie, devient transparente, brillante et souple. Elle ne jaunit pas avec le temps et garde sa brillance pendant des années.' },
			],
			faqTitle: 'Questions fréquentes sur les stickers résinés',
			cta: 'vos stickers résinés',
			care: { title: 'Première fois avec des', hl: 'stickers résinés ?', intro: 'La résine met le design en valeur, mais elle demande de la précision. C’est pourquoi nous contrôlons tout avant d’imprimer.', checks: ['Contrôle du fichier et des zones de coulée', 'Vérification et ajustement de la forme et des angles', 'Aperçu de l’effet bombé avant de commander', 'Vous voyez exactement le résultat final', 'On imprime ce que vous avez vu, sans surprise'], closing: 'Aucune surprise. Juste des stickers faits comme il faut.' },
			reviewsTitle: 'Spoiler :', reviewsHl: 'l’effet 3D fait vraiment mouche', reviewsSub: 'Commandes réelles. Résultats concrets.'
		},
		adesivi_rilievo: {
			name: 'Stickers en relief', title: 'Stickers en relief',
			seoTitle: 'Stickers en relief personnalisés avec vernis UV sélectif | Stickerprint',
			seoDesc: 'Stickers avec relief UV sélectif : des détails qui se sentent au toucher, finition brillante ou mate, découpe sur mesure. Aperçu immédiat avant de commander.',
			seoCategory: 'Stickers en relief',
			sub: 'Relief sélectif. Le détail prend de l’épaisseur.',
			desc: 'Vernis sélectif appliqué uniquement là où il faut. Certains détails prennent du relief, d’autres restent plats. Le résultat ? Un sticker qui se regarde et qui se touche.',
			checks: ['Aperçu automatique immédiat', 'Livraison estimée {ship} · gratuite dès {soglia}', 'On n’imprime que si c’est réussi', 'Aucune surprise sur le résultat', 'Effet relief appliqué avec précision'],
			cosa: 'Stickers en relief. Des détails qui ressortent. Des résultats incroyables. L’effet relief est appliqué uniquement sur certaines parties du visuel. Certains éléments restent plats, d’autres gagnent en profondeur. Le résultat est un sticker qui ne se voit pas seulement, il se sent au toucher.',
			faq: [
				{ q: 'Les stickers en relief ont-ils une lamination de protection ?', a: 'Oui, les stickers en relief sont protégés par une lamination transparente qui préserve à la fois l’impression et l’effet relief. La lamination garantit la résistance aux rayures, aux UV et aux intempéries, en gardant l’effet 3D intact dans le temps.' },
				{ q: 'Faut-il imprimer le blanc ?', a: 'En général non. Nos stickers en relief sont imprimés sur vinyle blanc, le blanc est donc déjà présent comme base. L’impression du blanc ne sert que si vous avez besoin d’un blanc couvrant sur des supports transparents ou colorés.' },
				{ q: 'Quelle est la tenue en extérieur ?', a: 'Les stickers en relief sont réalisés avec des matériaux de haute qualité et une lamination de protection. Ils résistent parfaitement à la pluie, au soleil, au vent et au froid. L’effet relief garde sa consistance et les couleurs restent éclatantes pendant plusieurs années, même en extérieur.' },
				{ q: 'Où placer l’effet relief ?', a: 'L’effet relief donne le meilleur sur des détails précis du design : logos, textes, contours ou éléments graphiques que vous voulez faire ressortir. Il n’est pas conseillé de l’appliquer sur toute la surface, seulement sur les parties à mettre en avant. C’est le contraste entre zones plates et zones en relief qui crée l’effet wahou.' },
				{ q: 'Que veulent dire finition brillante et mate ?', a: 'L’effet relief peut être appliqué en finition brillante ou mate. Le brillant crée un effet lumineux et réfléchissant sur les zones en relief, tandis que le mat donne un aspect plus élégant et satiné. Le choix dépend du rendu que vous recherchez.' },
			],
			faqTitle: 'Questions fréquentes sur les stickers en relief',
			cta: 'vos stickers en relief',
			care: { title: 'Relief précis.', hl: 'Aucune surprise.', intro: 'Le relief est appliqué uniquement là où ça compte. Le résultat est donc exactement celui que vous attendez.', checks: ['Nous contrôlons le fichier et les zones indiquées pour le relief', 'Nous corrigeons les éventuels détails techniques', 'Nous appliquons le vernis uniquement là où vous le demandez', 'Aperçu du résultat final avant de commander', 'En impression dès que vous confirmez la commande'], closing: 'Résultat : un effet relief précis, fidèle au design. Pas d’expériences. Pas de surprises.' },
			reviewsTitle: 'Spoiler :', reviewsHl: 'le relief fait la différence.', reviewsSub: 'Commandes réelles. Résultats concrets.'
		},
		etichette: {
			name: 'Étiquettes en planches', title: 'Étiquettes en planches',
			seoTitle: 'Étiquettes adhésives personnalisées en planches | Stickerprint',
			seoDesc: 'Étiquettes personnalisées en planches pour produits, packaging et colis : matériaux résistants, lamination de protection, prédécoupe facile à détacher.',
			seoCategory: 'Étiquettes adhésives',
			sub: 'De l’ordre, de la rapidité, un résultat net.',
			desc: 'Plusieurs étiquettes sur une seule planche, prêtes à poser. Idéales pour le packaging, les produits et les envois. Quand il faut de la praticité et de la qualité, ensemble.',
			checks: ['Plusieurs étiquettes sur une seule planche', 'Faciles à détacher, pose manuelle rapide', 'Matériaux résistants à l’eau, à l’huile et à l’usage quotidien', 'Finition de protection pour un rendu net', 'Aperçu automatique immédiat'],
			cosa: 'Des étiquettes adhésives disposées sur planche, conçues pour être posées à la main rapidement et avec précision. Résistantes, lisibles, fiables. Quand le packaging doit être à la hauteur du contenu.',
			faq: [
				{ q: 'Les étiquettes ont-elles une lamination de protection ?', a: 'Oui, toutes nos étiquettes en planches sont recouvertes d’une lamination transparente qui les rend résistantes aux rayures, à l’eau, à l’huile et à l’usage quotidien. La lamination garantit un rendu net et durable.' },
				{ q: 'Faut-il imprimer le blanc ?', a: 'En général non. Les étiquettes sont imprimées sur vinyle blanc, le blanc est donc déjà présent comme base. L’impression du blanc ne sert que si vous avez besoin d’un blanc couvrant sur des supports transparents ou colorés.' },
				{ q: 'Quelle est la tenue en extérieur ?', a: 'Nos étiquettes en planches sont réalisées avec des matériaux de haute qualité et une lamination de protection. Elles résistent à l’eau, à l’huile, aux aliments et à l’usage quotidien. Elles sont surtout conçues pour le packaging, les produits et les envois, et gardent leur qualité dans le temps.' },
				{ q: 'Comment les étiquettes sont-elles disposées sur la planche ?', a: 'Les étiquettes sont disposées sur des planches pratiques, en optimisant l’espace pour garantir le plus grand nombre d’étiquettes par planche. Elles sont prédécoupées et faciles à détacher, prêtes à être posées à la main rapidement et avec précision.' },
				{ q: 'Puis-je choisir la forme des étiquettes ?', a: 'Absolument. Nous proposons des étiquettes rondes, carrées, rectangulaires, ovales et découpées à la forme. La découpe suit parfaitement le contour de votre design grâce à une technologie de pointe, avec une précision au millimètre.' },
			],
			faqTitle: 'Questions fréquentes sur les étiquettes en planches',
			cta: 'vos étiquettes en planches',
			care: { title: 'Zéro stress.', hl: 'Même quand vous étiquetez beaucoup.', intro: 'Vous pensez au produit. Nous, aux étiquettes. Qu’elles servent à la vente, à l’expédition ou au stockage, les étiquettes doivent fonctionner tout de suite. C’est pourquoi nous contrôlons tout avant de lancer l’impression.', checks: ['Contrôle du fichier et des dimensions', 'Vérification de la découpe et de la disposition sur la planche', 'Aperçu automatique avant de payer', 'En production dès que vous confirmez la commande', 'Aucune surprise à la pose'], closing: '' },
			reviewsTitle: 'Spoiler :', reviewsHl: 'elles font gagner du temps.', reviewsSub: 'Et quand on étiquette beaucoup, ça fait la différence.'
		},
		fogli_adesivi: {
			name: 'Planches de stickers', title: 'Planches de stickers',
			seoTitle: 'Planches de stickers personnalisées | Stickerprint',
			seoDesc: 'Planches de stickers avec plusieurs visuels : trois formats, portrait ou paysage, fond au choix et prédécoupe sur chaque sticker. Parfaites pour kits et merch.',
			seoCategory: 'Planches de stickers',
			sub: 'Le moyen le plus malin de créer des kits, des sets et des collections.',
			desc: 'Rassemblez plusieurs stickers, même différents les uns des autres, sur une seule planche. Vous les disposez vous-même ou nous le faisons pour vous. Idéales pour le merch, les événements, le packaging et les kits prêts à l’emploi.',
			checks: ['Aperçu automatique immédiat', 'Livraison estimée {ship} · gratuite dès {soglia}', 'Prédécoupe sur chaque sticker (ils se détachent facilement)', 'Plusieurs formes différentes sur la même planche', 'On n’imprime que si c’est réussi'],
			cosa: 'Des planches de stickers personnalisées avec plusieurs visuels dans la même mise en page. Chaque sticker est découpé individuellement, mais reste sur la planche. Parfaites quand vous voulez de la variété, de l’ordre et un résultat professionnel.',
			faq: [
				{ q: 'Combien de stickers différents puis-je mettre sur une planche ?', a: 'Autant que vous voulez, même avec des visuels différents les uns des autres. Nous les disposons dans la mise en page optimale, ou vous pouvez nous indiquer la disposition que vous préférez.' },
				{ q: 'Faut-il imprimer le blanc ?', a: 'En général non. Les planches de stickers sont imprimées sur vinyle blanc, le blanc est donc déjà présent comme base. L’impression du blanc ne sert que si vous avez besoin d’un blanc couvrant sur des supports transparents ou colorés.' },
				{ q: 'Quelle est la tenue en extérieur ?', a: 'Nos planches de stickers sont réalisées avec des matériaux de haute qualité et une lamination de protection. Elles résistent à l’eau, à l’huile, aux aliments et à l’usage quotidien. Elles sont surtout conçues pour le packaging, les produits et les envois, et gardent leur qualité dans le temps.' },
				{ q: 'Comment fonctionne la prédécoupe ?', a: 'La prédécoupe (kiss-cut) ne coupe que le sticker, sans traverser la feuille support. Chaque sticker se détache ainsi facilement de la planche, prêt à être posé. C’est la solution idéale pour les kits, les sets et les collections.' },
				{ q: 'Puis-je avoir des formes différentes sur la même planche ?', a: 'Absolument. Vous pouvez combiner des stickers ronds, carrés, rectangulaires, ovales et découpés à la forme sur la même planche. Chaque sticker aura sa propre prédécoupe, pour créer des sets et des collections sur mesure.' },
			],
			faqTitle: 'Questions fréquentes sur les planches de stickers',
			cta: 'vos planches de stickers',
			care: { title: 'Chaque sticker', hl: 'à sa place.', intro: 'Vous pensez au design. Nous nous occupons du reste, vraiment.', checks: ['Contrôle du fichier et des marges de découpe', 'Vérification de la prédécoupe sur chaque sticker', 'Nous ajustons la mise en page si besoin', 'Aperçu automatique avant de payer', 'En impression dès que vous confirmez la commande'], closing: 'Aucune surprise. Aucune planche gâchée.' },
			reviewsTitle: 'Spoiler :', reviewsHl: 'commandes réelles, usage réel.', reviewsSub: 'Des avis sincères.'
		},
		vetrofanie: {
			name: 'Stickers vitrine', title: 'Stickers vitrine',
			seoTitle: 'Stickers vitrine personnalisés pour commerces et entreprises | Stickerprint',
			seoDesc: 'Stickers vitrine posés à l’intérieur de la vitre et lus de l’extérieur : découpe sur mesure, couleurs nettes, aperçu immédiat. Pour commerces et bureaux.',
			seoCategory: 'Stickers vitrine',
			sub: 'Visibles dehors. Parfaits dedans.',
			desc: 'Des stickers conçus pour être posés à l’intérieur de la vitre et lus parfaitement de l’extérieur. Nets, professionnels, faits pour durer sur les vitrines, les bureaux et les espaces commerciaux.',
			checks: ['Pose à l’intérieur, lecture parfaite de l’extérieur', 'Vinyle résistant, couleurs nettes', 'Découpe précise sur mesure', 'Aperçu automatique immédiat', 'On n’imprime que si c’est réussi'],
			cosa: 'Des stickers vitrine en vinyle à adhésif frontal, conçus pour être posés à l’intérieur des vitrines et des fenêtres. Protection dans le temps, rendu net, communication claire et professionnelle. Quand le message doit durer autant que votre activité.',
			faq: [
				{ q: 'Les stickers vitrine ont-ils une lamination de protection ?', a: 'Oui, nos stickers vitrine sont protégés par une lamination transparente qui garantit la résistance aux rayures et aux UV. La protection garde les couleurs vives et la lisibilité dans le temps, même en exposition directe à la lumière.' },
				{ q: 'Faut-il imprimer le blanc ?', a: 'Oui, pour les stickers vitrine le blanc est indispensable. Comme ils sont posés à l’intérieur de la vitre et lus de l’extérieur, l’impression du blanc garantit des couleurs couvrantes et visibles à travers la vitre. Sans le blanc, le sticker paraîtrait transparent.' },
				{ q: 'Quelle est la tenue en extérieur ?', a: 'Les stickers vitrine sont conçus pour durer. Posés à l’intérieur de la vitre, ils sont à l’abri des intempéries. Le vinyle et la lamination garantissent la résistance aux UV et gardent des couleurs nettes pendant plusieurs années.' },
				{ q: 'Comment poser les stickers vitrine ?', a: 'Les stickers vitrine se posent à l’intérieur de la vitre, adhésif tourné vers la surface. Ils se lisent parfaitement de l’extérieur grâce à l’impression en miroir. La pose est simple : il suffit de nettoyer la vitre, de positionner le sticker et d’appuyer pour chasser les bulles d’air.' },
				{ q: 'Puis-je les utiliser sur n’importe quelle vitre ?', a: 'Oui, les stickers vitrine se posent sur toute surface vitrée lisse : vitrines de magasins, fenêtres de bureaux, portes vitrées, voitures et bien plus. L’adhésif est conçu pour adhérer parfaitement au verre sans laisser de résidus au retrait.' },
			],
			faqTitle: 'Questions fréquentes sur les stickers vitrine',
			cta: 'vos stickers vitrine',
			care: { title: 'Zéro stress.', hl: 'Même sur une vitre.', intro: 'Vous chargez le fichier. Nous nous occupons du reste. Les stickers vitrine ont l’air simples, mais ils demandent de l’attention sur l’orientation, les bords et le rendu final. C’est pourquoi nous contrôlons tout avant d’imprimer.', checks: ['Contrôle de l’orientation et de l’effet miroir', 'Vérification des bords et de la découpe pour la pose sur vitre', 'Aperçu automatique avant de payer', 'On imprime ce que vous avez vu', 'Aucune surprise sur le résultat'], closing: '' },
			reviewsTitle: 'Spoiler :', reviewsHl: 'ils se remarquent. Et pas qu’un peu.', reviewsSub: 'Vraies vitrines. Vrais retours.'
		}
	},
	kit: { price: '10€', checks: ['Vous recevez nos meilleurs stickers', 'Vous touchez notre qualité du doigt', 'Vous testez tous nos produits', 'Vous choisissez le matériau parfait pour vous', 'Vous le récupérez tout de suite sur votre première commande'] }
};
