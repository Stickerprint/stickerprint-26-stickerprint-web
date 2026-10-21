/** Testi prodotto in lingua "es" (spagnolo di Spagna, tú). Stesse chiavi di testiIt: vedi docs/traduzioni.md (tono, glossario). */
import type { TestiLingua } from './it';

export const testiEs: TestiLingua = {
	prodotti: {
		adesivi_personalizzati: {
			name: 'Pegatinas personalizadas', title: 'Pegatinas personalizadas', h1: ['Pegatinas', 'personalizadas'],
			seoTitle: 'Pegatinas personalizadas online con vista previa inmediata | Stickerprint',
			seoDesc: 'Pegatinas personalizadas de vinilo, troqueladas con cualquier forma, mate o brillo. Sube tu archivo, ve la vista previa al momento y pide desde 15 unidades.',
			seoCategory: 'Pegatinas personalizadas',
			sub: 'Bien hechas. Y punto.',
			desc: 'Materiales premium. Impresión de alta calidad. Corte preciso. Tú subes el archivo, del resto nos encargamos nosotros.',
			checks: ['Prueba automática al instante', 'Envío estimado {ship} · gratis a partir de {soglia}', 'Solo imprimimos si queda bien', 'Sin sorpresas en el resultado'],
			cosa: 'Pegatinas cortadas a medida e impresas para durar. Colores intensos, detalles limpios, materiales que aguantan el uso, el tiempo y los envíos. Las pegas, las envías, las haces circular. Y cumplen con su trabajo. Durante mucho tiempo.',
			faq: [
				{ q: '¿Qué significa corte troquelado?', a: 'El corte troquelado sigue exactamente el contorno de tu diseño, sin el borde blanco rectangular. La pegatina se corta a medida con una máquina de precisión que sigue la forma de tu archivo, para un resultado limpio y profesional.' },
				{ q: '¿Hace falta imprimir el color blanco?', a: 'Normalmente no. Nuestras pegatinas personalizadas se imprimen sobre vinilo blanco, así que el blanco ya está como base. La tinta blanca solo hace falta si necesitas un blanco opaco sobre materiales transparentes o de color.' },
				{ q: '¿Cuánto aguantan en exterior?', a: 'Nuestras pegatinas personalizadas están hechas de vinilo de alta calidad con laminado protector. Resisten lluvia, sol, viento y frío. En condiciones normales mantienen los colores vivos y la adherencia durante varios años, también en exterior.' },
				{ q: '¿Cómo se protege la pegatina?', a: 'Cada pegatina se recubre con un laminado protector transparente que la protege de arañazos, rayos UV, humedad y desgaste diario. Esta protección mantiene los colores vivos y la superficie intacta con el tiempo.' },
			],
			faqTitle: 'Preguntas frecuentes sobre las pegatinas personalizadas',
			cta: 'tus pegatinas personalizadas',
			compare: {
				titlePre: 'No todas las pegatinas están hechas para', titleHl: 'durar.', hl: 'blue',
				sub: 'Hay quien ahorra en materiales. Nosotros preferimos no ahorrar en tu resultado.',
				usHead: 'Pegatinas Stickerprint', themHead: 'Pegatinas baratas',
				rows: [
					{ icon: 'layers', label: 'Materiales', us: 'Vinilos premium seleccionados', them: 'Materiales baratos' },
					{ icon: 'print', label: 'Impresión', us: 'No se destiñe, ni siquiera sin laminado', them: 'Desteñidas a los pocos días' },
					{ icon: 'shield', label: 'Protección', us: 'Laminado protector extra disponible', them: 'Ni incluido ni disponible' },
					{ icon: 'cut', label: 'Corte', us: 'Preciso, también con forma personalizada', them: 'Formatos más estandarizados' },
					{ icon: 'sliders', label: 'Personalización', us: 'Medidas, acabados y materiales a tu gusto', them: 'Formatos estándar, materiales estándar' },
					{ icon: 'people', label: 'Experiencia', us: '19 años de experiencia en impresión', them: 'No siempre declarada' }
				],
				closing: 'Una pegatina barata cuesta menos una vez. Una pegatina bien hecha vale más cada día.',
				cta: 'Crea tus pegatinas →', href: '#preventivatore'
			},
			care: { title: 'Cero agobios.', hl: 'Nos encargamos nosotros.', intro: '¿Es tu primer pedido? Tranquilo. Esta es la lista de comprobaciones que hacemos en cada pedido:', checks: ['Revisión manual de cada archivo', 'Si hace falta, arreglamos el archivo antes de imprimir', 'Vista previa automática del resultado antes de pagar', 'Ves exactamente cómo haremos tu producto', 'Imprimimos lo que has visto, sin sorpresas'], closing: '' },
			reviewsTitle: 'Qué dicen de', reviewsHl: 'estas pegatinas.', reviewsSub: 'Pedidos reales. Resultados concretos.'
		},
		adesivi_resinati: {
			name: 'Pegatinas resinadas', title: 'Pegatinas resinadas',
			seoTitle: 'Pegatinas resinadas 3D personalizadas | Stickerprint',
			seoDesc: 'Pegatinas resinadas con cúpula 3D: efecto abombado, colores profundos y resina protectora. Redondas, cuadradas, ovaladas o troqueladas, con vista previa.',
			seoCategory: 'Pegatinas resinadas',
			sub: 'Volumen de verdad. Efecto premium garantizado.',
			desc: 'Acabado abombado, brillante y tridimensional. Para cuando el diseño no solo tiene que verse. Tiene que llamar la atención.',
			checks: ['Resina premium ultrabrillante', 'Prueba automática al instante', 'Envío estimado {ship} · gratis a partir de {soglia}', 'Solo imprimimos si queda bien', 'Sin sorpresas en el resultado'],
			cosa: 'Pegatinas resinadas. Efecto premium que se nota desde el primer momento. Acabado abombado 3D, colores más profundos y una resina que protege y realza el diseño. Para cuando la pegatina no solo tiene que pegarse, sino destacar.',
			faq: [
				{ q: '¿Por qué hacen falta las esquinas redondeadas?', a: 'Las esquinas redondeadas son necesarias para que la resina se reparta perfectamente. Con esquinas vivas, la resina tiende a no distribuirse de forma uniforme y puede crear imperfecciones. Las esquinas redondeadas aseguran una cobertura homogénea y un resultado impecable.' },
				{ q: '¿Hace falta imprimir el color blanco?', a: 'Sí, el blanco es fundamental en las pegatinas resinadas. Como la resina es transparente, sin una base blanca los colores quedarían apagados o translúcidos. La impresión del blanco garantiza colores vivos y brillantes bajo la cúpula de resina.' },
				{ q: '¿Cuánto aguantan en exterior?', a: 'Las pegatinas resinadas son extremadamente resistentes a las condiciones exteriores. La resina protege de los rayos UV, del agua, de los agentes atmosféricos y del desgaste mecánico. En condiciones normales mantienen su aspecto durante varios años, también en exterior.' },
				{ q: '¿Cómo se protege la pegatina?', a: 'La pegatina queda protegida por una cúpula de resina de poliuretano transparente, aplicada con precisión mediante máquinas CNC. Esta cúpula crea una barrera física que protege la impresión de arañazos, humedad, rayos UV y agentes químicos.' },
				{ q: '¿Qué tipo de resina utilizáis?', a: 'Utilizamos resina de poliuretano de alta calidad, específica para pegatinas. Es una resina bicomponente que, una vez endurecida, queda transparente, brillante y flexible. No amarillea con el tiempo y mantiene su brillo durante años.' },
			],
			faqTitle: 'Preguntas frecuentes sobre las pegatinas resinadas',
			cta: 'tus pegatinas resinadas',
			care: { title: '¿Primera vez con', hl: 'pegatinas resinadas?', intro: 'La resina realza el diseño, pero hay que trabajarla con precisión. Por eso lo revisamos todo antes de imprimir.', checks: ['Revisión del archivo y de las zonas de resinado', 'Comprobación y ajuste de la forma y las esquinas', 'Vista previa del efecto abombado antes de pedir', 'Ves exactamente el resultado final', 'Imprimimos lo que has visto, sin sorpresas'], closing: 'Sin sorpresas. Solo pegatinas hechas como es debido.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'el efecto 3D convence de verdad', reviewsSub: 'Pedidos reales. Resultados concretos.'
		},
		adesivi_rilievo: {
			name: 'Pegatinas en relieve', title: 'Pegatinas en relieve',
			seoTitle: 'Pegatinas en relieve personalizadas con barniz UV | Stickerprint',
			seoDesc: 'Pegatinas con relieve UV selectivo: detalles que se notan al tacto, acabado brillo o mate, corte a medida. Vista previa inmediata antes de pedir.',
			seoCategory: 'Pegatinas en relieve',
			sub: 'Relieve selectivo. El detalle gana cuerpo.',
			desc: 'Barniz selectivo aplicado solo donde hace falta. Algunos detalles cobran relieve, otros se quedan planos. ¿El resultado? Una pegatina que se ve y se siente.',
			checks: ['Prueba automática al instante', 'Envío estimado {ship} · gratis a partir de {soglia}', 'Solo imprimimos si queda bien', 'Sin sorpresas en el resultado', 'Efecto relieve aplicado con precisión'],
			cosa: 'Pegatinas en relieve. Detalles que sobresalen. Resultados increíbles. Efecto relieve aplicado solo en partes concretas del diseño. Algunos elementos se quedan planos, otros ganan profundidad. El resultado es una pegatina que no solo se ve, sino que se percibe al tacto.',
			faq: [
				{ q: '¿Las pegatinas en relieve llevan laminado protector?', a: 'Sí, las pegatinas en relieve se protegen con un laminado transparente que conserva tanto la impresión como el efecto relieve. El laminado garantiza resistencia a arañazos, rayos UV y agentes atmosféricos, manteniendo intacto el efecto tridimensional con el tiempo.' },
				{ q: '¿Hace falta imprimir el color blanco?', a: 'Normalmente no. Nuestras pegatinas en relieve se imprimen sobre vinilo blanco, así que el blanco ya está como base. La tinta blanca solo hace falta si necesitas un blanco opaco sobre materiales transparentes o de color.' },
				{ q: '¿Cuánto aguantan en exterior?', a: 'Las pegatinas en relieve están hechas con materiales de alta calidad y laminado protector. Resisten perfectamente lluvia, sol, viento y frío. El efecto relieve mantiene su consistencia y los colores siguen vivos durante varios años, también en exterior.' },
				{ q: '¿Dónde conviene poner el efecto relieve?', a: 'El efecto relieve luce mejor en detalles concretos del diseño: logotipos, textos, bordes o elementos gráficos que quieras resaltar. No se recomienda aplicarlo en toda la superficie, solo en las partes que quieras destacar. El contraste entre zonas planas y zonas en relieve es lo que crea el efecto wow.' },
				{ q: '¿Qué significa acabado brillo y mate?', a: 'El efecto relieve puede aplicarse con acabado brillo o mate. El brillo crea un efecto luminoso y reflectante en las zonas en relieve, mientras que el mate aporta un aspecto más elegante y satinado. La elección depende del resultado estético que busques.' },
			],
			faqTitle: 'Preguntas frecuentes sobre las pegatinas en relieve',
			cta: 'tus pegatinas en relieve',
			care: { title: 'Relieve preciso.', hl: 'Sin sorpresas.', intro: 'El relieve se aplica solo donde importa. Así el resultado es exactamente el que esperas.', checks: ['Revisamos el archivo y las zonas indicadas para el relieve', 'Ajustamos los detalles técnicos que haga falta', 'Aplicamos el barniz solo donde lo pides', 'Vista previa del resultado final antes de pedir', 'A imprenta en cuanto confirmas el pedido'], closing: 'Resultado: un efecto relieve preciso, fiel al diseño. Sin experimentos. Sin sorpresas.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'el relieve marca la diferencia.', reviewsSub: 'Pedidos reales. Resultados concretos.'
		},
		etichette: {
			name: 'Etiquetas en hojas', title: 'Etiquetas en hojas',
			seoTitle: 'Etiquetas adhesivas personalizadas en hojas | Stickerprint',
			seoDesc: 'Etiquetas personalizadas en hojas para productos, packaging y envíos: materiales resistentes, laminado protector y medio corte para despegarlas fácil.',
			seoCategory: 'Etiquetas adhesivas',
			sub: 'Orden, rapidez, resultado limpio.',
			desc: 'Varias etiquetas en una sola hoja, listas para aplicar. Ideales para packaging, productos y envíos. Para cuando necesitas practicidad y calidad, juntas.',
			checks: ['Varias etiquetas en una sola hoja', 'Se despegan fácil, aplicación manual rápida', 'Materiales resistentes al agua, al aceite y al uso diario', 'Acabado protector para un resultado limpio', 'Prueba automática al instante'],
			cosa: 'Etiquetas adhesivas dispuestas en hojas, pensadas para aplicarse a mano de forma rápida y precisa. Resistentes, legibles, fiables. Para cuando el packaging tiene que estar a la altura del contenido.',
			faq: [
				{ q: '¿Las etiquetas llevan laminado protector?', a: 'Sí, todas nuestras etiquetas en hojas se recubren con un laminado protector transparente que las hace resistentes a arañazos, agua, aceite y uso diario. El laminado garantiza un resultado limpio y duradero.' },
				{ q: '¿Hace falta imprimir el color blanco?', a: 'Normalmente no. Las etiquetas se imprimen sobre vinilo blanco, así que el blanco ya está como base. La tinta blanca solo hace falta si necesitas un blanco opaco sobre materiales transparentes o de color.' },
				{ q: '¿Cuánto aguantan en exterior?', a: 'Nuestras etiquetas en hojas están hechas con materiales de alta calidad y laminado protector. Resisten agua, aceite, alimentos y uso diario. Están pensadas sobre todo para packaging, productos y envíos, y mantienen su calidad con el tiempo.' },
				{ q: '¿Cómo van dispuestas las etiquetas en la hoja?', a: 'Las etiquetas se disponen en hojas cómodas de usar, optimizando el espacio para que quepan el máximo de etiquetas por hoja. Vienen precortadas y se despegan fácilmente, listas para aplicarlas a mano de forma rápida y precisa.' },
				{ q: '¿Puedo elegir la forma de las etiquetas?', a: 'Por supuesto. Ofrecemos etiquetas redondas, cuadradas, rectangulares, ovaladas y troqueladas. El corte sigue perfectamente el contorno de tu diseño con tecnología avanzada, con precisión milimétrica.' },
			],
			faqTitle: 'Preguntas frecuentes sobre las etiquetas en hojas',
			cta: 'tus etiquetas en hojas',
			care: { title: 'Cero estrés.', hl: 'Aunque etiquetes mucho.', intro: 'Tú piensas en el producto. Nosotros en las etiquetas. Sean para venta, envío o almacén, las etiquetas tienen que funcionar desde el primer momento. Por eso lo revisamos todo antes de imprimir.', checks: ['Revisión del archivo y de las medidas', 'Comprobación del corte y de la disposición en la hoja', 'Vista previa automática antes de pagar', 'En producción en cuanto confirmas el pedido', 'Sin sorpresas al aplicarlas'], closing: '' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'ahorran tiempo.', reviewsSub: 'Y cuando etiquetas mucho, se nota.'
		},
		fogli_adesivi: {
			name: 'Hojas de pegatinas', title: 'Hojas de pegatinas',
			seoTitle: 'Hojas de pegatinas personalizadas | Stickerprint',
			seoDesc: 'Hojas de pegatinas con varios diseños en la misma hoja: tres formatos, vertical u horizontal y medio corte en cada pegatina. Perfectas para packs y merch.',
			seoCategory: 'Hojas de pegatinas',
			sub: 'La forma más inteligente de crear packs, sets y colecciones.',
			desc: 'Pon varias pegatinas, incluso distintas entre sí, en una sola hoja. Las colocas tú o lo hacemos nosotros por ti. Ideales para merch, eventos, packaging y packs listos para usar.',
			checks: ['Prueba automática al instante', 'Envío estimado {ship} · gratis a partir de {soglia}', 'Medio corte en cada pegatina (se despegan fácil)', 'Varias formas distintas en la misma hoja', 'Solo imprimimos si queda bien'],
			cosa: 'Hojas de pegatinas personalizadas con varios diseños en la misma composición. Cada pegatina está cortada por separado, pero se queda en la hoja. Perfectas cuando quieres variedad, orden y un resultado profesional.',
			faq: [
				{ q: '¿Cuántas pegatinas distintas puedo poner en una hoja?', a: 'Puedes poner tantas pegatinas distintas como quieras en la misma hoja, incluso con diseños diferentes entre sí. Nosotros las colocamos en la composición óptima, o puedes indicarnos tú la disposición que prefieras.' },
				{ q: '¿Hace falta imprimir el color blanco?', a: 'Normalmente no. Las hojas de pegatinas se imprimen sobre vinilo blanco, así que el blanco ya está como base. La tinta blanca solo hace falta si necesitas un blanco opaco sobre materiales transparentes o de color.' },
				{ q: '¿Cuánto aguantan en exterior?', a: 'Nuestras hojas de pegatinas están hechas con materiales de alta calidad y laminado protector. Resisten agua, aceite, alimentos y uso diario. Están pensadas sobre todo para packaging, productos y envíos, y mantienen su calidad con el tiempo.' },
				{ q: '¿Cómo funciona el medio corte?', a: 'El medio corte (kiss-cut) corta solo la pegatina, sin atravesar la hoja de soporte. Así cada pegatina se despega fácilmente de la hoja, lista para aplicar. Es la solución ideal para packs, sets y colecciones.' },
				{ q: '¿Puedo tener formas distintas en la misma hoja?', a: 'Por supuesto. Puedes combinar pegatinas redondas, cuadradas, rectangulares, ovaladas y troqueladas en la misma hoja. Cada pegatina tendrá su propio medio corte personalizado, para que crees sets y colecciones a tu medida.' },
			],
			faqTitle: 'Preguntas frecuentes sobre las hojas de pegatinas',
			cta: 'tus hojas de pegatinas',
			care: { title: 'Cada pegatina', hl: 'en su sitio.', intro: 'Tú piensas en el diseño. Del resto nos encargamos nosotros, de verdad.', checks: ['Revisión del archivo y de los márgenes de corte', 'Comprobación del medio corte en cada pegatina', 'Ajustamos la composición si hace falta', 'Vista previa automática antes de pagar', 'A imprenta en cuanto confirmas el pedido'], closing: 'Sin sorpresas. Ni una hoja desperdiciada.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'pedidos reales, uso real.', reviewsSub: 'Opiniones de verdad.'
		},
		vetrofanie: {
			name: 'Vinilos para escaparate', title: 'Vinilos para escaparate',
			seoTitle: 'Vinilos para escaparate personalizados para tiendas y empresas | Stickerprint',
			seoDesc: 'Vinilos para escaparate que se aplican por dentro del cristal y se leen desde fuera: corte a medida, colores nítidos, vista previa inmediata.',
			seoCategory: 'Vinilos para escaparate',
			sub: 'Visibles desde fuera. Perfectos por dentro.',
			desc: 'Vinilos pensados para aplicarse por dentro del cristal y leerse perfectamente desde fuera. Limpios, profesionales, hechos para durar en escaparates, oficinas y locales comerciales.',
			checks: ['Aplicación interior, lectura exterior perfecta', 'Vinilo resistente, colores nítidos', 'Corte preciso a medida', 'Prueba automática al instante', 'Solo imprimimos si queda bien'],
			cosa: 'Vinilos para escaparate con adhesivo frontal, diseñados para aplicarse por dentro de escaparates y ventanas. Protección duradera, resultado limpio, comunicación clara y profesional. Para cuando el mensaje tiene que durar tanto como tu negocio.',
			faq: [
				{ q: '¿Los vinilos para escaparate llevan laminado protector?', a: 'Sí, nuestros vinilos para escaparate van protegidos con un laminado transparente que garantiza resistencia a arañazos y rayos UV. La protección mantiene los colores vivos y la legibilidad con el tiempo, incluso con exposición directa a la luz.' },
				{ q: '¿Hace falta imprimir el color blanco?', a: 'Sí, en los vinilos para escaparate el blanco es fundamental. Al aplicarse por dentro del cristal y leerse desde fuera, la impresión del blanco garantiza que los colores sean opacos y visibles a través del cristal. Sin el blanco, el vinilo quedaría transparente.' },
				{ q: '¿Cuánto aguantan en exterior?', a: 'Los vinilos para escaparate están diseñados para durar. Al aplicarse por dentro del cristal, quedan protegidos de los agentes atmosféricos exteriores. El vinilo y el laminado garantizan resistencia a los rayos UV y mantienen los colores nítidos durante varios años.' },
				{ q: '¿Cómo se aplican los vinilos para escaparate?', a: 'Los vinilos para escaparate se aplican por dentro del cristal, con el adhesivo hacia la superficie. Se leen perfectamente desde fuera gracias a la impresión en espejo. La aplicación es sencilla: basta con limpiar el cristal, colocar el vinilo y presionar para eliminar las burbujas de aire.' },
				{ q: '¿Puedo usarlos en cualquier cristal?', a: 'Sí, los vinilos para escaparate se aplican en cualquier superficie de cristal lisa: escaparates de tiendas, ventanas de oficinas, puertas de cristal, coches y mucho más. El adhesivo está pensado para adherirse perfectamente al cristal sin dejar residuos al retirarlo.' },
			],
			faqTitle: 'Preguntas frecuentes sobre los vinilos para escaparate',
			cta: 'tus vinilos para escaparate',
			care: { title: 'Cero estrés.', hl: 'También sobre cristal.', intro: 'Tú subes el archivo. Nosotros nos encargamos del resto. Los vinilos para escaparate parecen sencillos, pero requieren atención en la orientación, los bordes y el resultado final. Por eso lo revisamos todo antes de imprimir.', checks: ['Revisión de la orientación y del efecto espejo', 'Comprobación de bordes y corte para aplicación en cristal', 'Vista previa automática antes de pagar', 'Imprimimos lo que has visto', 'Sin sorpresas en el resultado'], closing: '' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'se notan. Y mucho.', reviewsSub: 'Escaparates reales. Opiniones reales.'
		}
	},
	kit: { price: '10€', checks: ['Recibes nuestras mejores pegatinas', 'Tocas con tus manos nuestra calidad', 'Pruebas todos nuestros productos', 'Eliges el material perfecto para ti', 'Lo recuperas enseguida en tu primer pedido'] }
};
