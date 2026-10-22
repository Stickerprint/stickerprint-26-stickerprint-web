/** Testi prodotto in lingua "en" (inglese americano). Stesse chiavi di testiIt: vedi docs/traduzioni.md (tono, glossario). */
import type { TestiLingua } from './it';

export const testiEn: TestiLingua = {
	prodotti: {
		adesivi_personalizzati: {
			name: 'Custom stickers', title: 'Custom stickers', h1: ['Custom', 'stickers'],
			seoTitle: 'Custom stickers with instant online preview | Stickerprint',
			seoDesc: 'Custom vinyl stickers, die-cut to any shape, matte or glossy. Upload your file, see the preview right away and order from 15 stickers. Printed in Italy.',
			seoCategory: 'Custom stickers',
			sub: 'Done right. Period.',
			desc: 'Premium materials. High-quality printing. Precise cutting. You upload the file, we handle the rest.',
			checks: ['Get an instant preview', 'Estimated ship date: {ship} · free shipping from {soglia}', 'We only print if it looks right', 'No surprises on the result'],
			cosa: 'Stickers cut to size and printed to last. Solid colors, clean details, materials that stand up to use, time and shipping. Stick them, ship them, pass them around. They do their job. For a long time.',
			faq: [
				{ q: 'What does die-cut mean?', a: 'Die-cut means the cut follows the exact outline of your design, with no rectangular white border. The sticker is cut to shape by a precision machine that traces your artwork, for a clean, professional result.' },
				{ q: 'Do I need white ink?', a: 'Usually not. Our custom stickers are printed on white vinyl, so white is already there as the base. White ink is only needed when you want an opaque white on clear or colored materials.' },
				{ q: 'How long do they last outdoors?', a: 'Our custom stickers are made from high-quality vinyl with a protective laminate. They hold up to rain, sun, wind and cold. Under normal conditions they keep their bright colors and grip for several years, even outdoors.' },
				{ q: 'How is the sticker protected?', a: 'Every sticker is coated with a clear protective laminate that shields it from scratches, UV rays, moisture and everyday wear. This keeps the colors vivid and the surface intact over time.' },
			],
			faqTitle: 'Frequently asked questions about custom stickers',
			cta: 'your custom stickers',
			compare: {
				titlePre: 'Not every sticker is made to', titleHl: 'last.', hl: 'blue',
				sub: 'Some cut corners on materials. We’d rather not cut corners on your result.',
				usHead: 'Stickerprint stickers', themHead: 'Cheap stickers',
				rows: [
					{ icon: 'layers', label: 'Materials', us: 'Hand-picked premium vinyl', them: 'Cheap materials' },
					{ icon: 'print', label: 'Printing', us: 'Fade-resistant, even without laminate', them: 'Faded after a few days' },
					{ icon: 'shield', label: 'Protection', us: 'Extra protective laminate available', them: 'Not included, not available' },
					{ icon: 'cut', label: 'Cutting', us: 'Precise, even on custom die-cut shapes', them: 'Mostly standard formats' },
					{ icon: 'sliders', label: 'Customization', us: 'Custom sizes, finishes and materials', them: 'Standard sizes, standard materials' },
					{ icon: 'people', label: 'Experience', us: '19 years of printing experience', them: 'Not always disclosed' }
				],
				closing: 'A cheap sticker costs less once. A sticker done right is worth more every single day.',
				cta: 'Create your stickers →', href: '#preventivatore'
			},
			care: { title: 'Zero stress.', hl: 'We’ve got it.', intro: 'First order? Don’t worry. Here’s the checklist we run on every order:', checks: ['Every file checked by hand', 'If needed, we fix the file before printing', 'Instant preview of the result before you pay', 'You see exactly how we’ll make your product', 'We print what you saw, no surprises'], closing: '' },
			reviewsTitle: 'What people say about', reviewsHl: 'these stickers.', reviewsSub: 'Real orders. Real results.'
		},
		adesivi_resinati: {
			name: 'Domed stickers', title: 'Domed stickers',
			seoTitle: 'Custom domed stickers with 3D resin finish | Stickerprint',
			seoDesc: 'Custom domed stickers with a 3D resin dome: raised glossy finish, deep colors, lasting protection. Round, square, oval or die-cut, with instant preview.',
			seoCategory: 'Domed stickers',
			sub: 'Real depth. Premium look, guaranteed.',
			desc: 'Raised, glossy, three-dimensional finish. For when your design shouldn’t just be seen. It should get noticed.',
			checks: ['Ultra-glossy premium resin', 'Get an instant preview', 'Estimated ship date: {ship} · free shipping from {soglia}', 'We only print if it looks right', 'No surprises on the result'],
			cosa: 'Domed stickers. A premium look you notice right away. Raised 3D finish, deeper colors and a resin that protects and enhances the design. For when a sticker shouldn’t just stick, but stand out.',
			faq: [
				{ q: 'Why do the corners need to be rounded?', a: 'Rounded corners are needed so the resin flows evenly. With sharp corners the resin tends not to spread uniformly and can leave flaws. Rounded corners ensure even coverage and a flawless result.' },
				{ q: 'Do I need white ink?', a: 'Yes, white is essential for domed stickers. Since the resin is clear, without a white base the colors would look washed out or see-through. White ink guarantees vivid, bright colors under the resin dome.' },
				{ q: 'How long do they last outdoors?', a: 'Domed stickers are extremely weather-resistant. The resin shields the print from UV rays, water, the elements and mechanical wear. Under normal conditions they keep their look for several years, even outdoors.' },
				{ q: 'How is the sticker protected?', a: 'The sticker is protected by a clear polyurethane resin dome, applied with precision by CNC machines. The dome forms a physical barrier that shields the print underneath from scratches, moisture, UV rays and chemicals.' },
				{ q: 'What kind of resin do you use?', a: 'We use high-quality polyurethane resin made specifically for stickers. It is a two-part resin that cures clear, glossy and flexible. It doesn’t yellow over time and stays brilliant for years.' },
			],
			faqTitle: 'Frequently asked questions about domed stickers',
			cta: 'your domed stickers',
			care: { title: 'First time with', hl: 'domed stickers?', intro: 'Resin makes a design shine, but it has to be handled with precision. That’s why we check everything before printing.', checks: ['File and resin-pour areas checked', 'Shape and corners verified and adjusted', 'Preview of the domed effect before you order', 'You see exactly the final result', 'We print what you saw, no surprises'], closing: 'No surprises. Just stickers done the way they should be.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'the 3D effect really wins people over', reviewsSub: 'Real orders. Real results.'
		},
		adesivi_rilievo: {
			name: 'Embossed stickers', title: 'Embossed stickers',
			seoTitle: 'Custom embossed stickers with spot UV | Stickerprint',
			seoDesc: 'Custom stickers with selective embossed spot UV: details you can feel, glossy or matte finish, cut to any shape. Instant preview before you order.',
			seoCategory: 'Embossed stickers',
			sub: 'Selective embossed print. Details with real depth.',
			desc: 'Spot varnish applied only where it matters. Some details rise up, others stay flat. The result? A sticker you can see and feel.',
			checks: ['Get an instant preview', 'Estimated ship date: {ship} · free shipping from {soglia}', 'We only print if it looks right', 'No surprises on the result', 'Embossed effect applied with precision'],
			cosa: 'Embossed stickers. Details that pop. Incredible results. The embossed effect goes only on specific parts of the artwork. Some elements stay flat, others gain depth. The result is a sticker you don’t just see, but feel.',
			faq: [
				{ q: 'Do embossed stickers have a protective laminate?', a: 'Yes, embossed stickers are protected with a clear laminate that preserves both the print and the embossed effect. The laminate guards against scratches, UV rays and the elements, keeping the 3D effect intact over time.' },
				{ q: 'Do I need white ink?', a: 'Usually not. Our embossed stickers are printed on white vinyl, so white is already there as the base. White ink is only needed when you want an opaque white on clear or colored materials.' },
				{ q: 'How long do they last outdoors?', a: 'Embossed stickers are made with high-quality materials and a protective laminate. They stand up perfectly to rain, sun, wind and cold. The embossed effect keeps its texture and the colors stay bright for several years, even outdoors.' },
				{ q: 'Where does the embossed effect work best?', a: 'The embossed effect works best on specific details of the design: logos, lettering, outlines or graphic elements you want to highlight. We don’t recommend covering the whole surface, only the parts you want to stand out. The contrast between flat and raised areas is what creates the wow effect.' },
				{ q: 'What do glossy and matte mean here?', a: 'The embossed effect can be applied with a glossy or a matte finish. Glossy gives the raised areas a bright, reflective look, while matte gives a more elegant, satin feel. It depends on the look you’re going for.' },
			],
			faqTitle: 'Frequently asked questions about embossed stickers',
			cta: 'your embossed stickers',
			care: { title: 'Precise relief.', hl: 'No surprises.', intro: 'The embossed effect goes only where it counts. So the result is exactly what you expect.', checks: ['We check the file and the areas marked for the embossed effect', 'We fix any technical details', 'We apply the spot varnish only where requested', 'Preview of the final result before you order', 'Into print as soon as you confirm your order'], closing: 'The result: a precise embossed effect, true to the design. No experiments. No surprises.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'the embossed effect makes the difference.', reviewsSub: 'Real orders. Real results.'
		},
		etichette: {
			name: 'Custom label sheets', title: 'Custom label sheets',
			seoTitle: 'Custom labels on sheets for products and packaging | Stickerprint',
			seoDesc: 'Custom labels on sheets for products, packaging and shipping: durable materials, protective laminate, kiss-cut for easy peeling. Order online with preview.',
			seoCategory: 'Adhesive labels',
			sub: 'Organized, fast, clean results.',
			desc: 'Multiple labels on one sheet, ready to peel and apply. Practical, high-quality labels for products, packaging, and shipping.',
			checks: ['Several labels on one sheet', 'Easy to peel, quick to apply by hand', 'Materials that resist water, oil and daily use', 'Protective finish for a clean look', 'Get an instant preview'],
			cosa: 'Adhesive labels laid out on sheets, designed to be applied by hand quickly and precisely. Durable, legible, reliable. For when the packaging has to live up to what’s inside.',
			faq: [
				{ q: 'Do the labels have a protective laminate?', a: 'Yes, all our labels on sheets are coated with a clear protective laminate that makes them resistant to scratches, water, oil and daily use. The laminate ensures a clean look that lasts.' },
				{ q: 'Do I need white ink?', a: 'Usually not. Labels are printed on white vinyl, so white is already there as the base. White ink is only needed when you want an opaque white on clear or colored materials.' },
				{ q: 'How long do they last outdoors?', a: 'Our labels on sheets are made with high-quality materials and a protective laminate. They resist water, oil, food and daily use. They are designed mainly for packaging, products and shipping, and keep their quality over time.' },
				{ q: 'How are the labels arranged on the sheet?', a: 'The labels are laid out on easy-to-handle sheets, with the space optimized to fit as many labels per sheet as possible. They are pre-cut and easy to peel, ready to be applied by hand quickly and precisely.' },
				{ q: 'Can I choose the label shape?', a: 'Absolutely. We offer round, square, rectangular, oval and die-cut labels. The cut follows the outline of your design perfectly thanks to advanced technology, with precision down to the millimeter.' },
			],
			faqTitle: 'Frequently asked questions about labels on sheets',
			cta: 'your labels on sheets',
			care: { title: 'Zero stress.', hl: 'Even when you label a lot.', intro: 'You focus on the product. We handle the labels. Whether they’re for retail, shipping or the warehouse, labels have to work right away. That’s why we check everything before going to print.', checks: ['File and size check', 'Cut and sheet layout verified', 'Instant preview before you pay', 'Into production as soon as you confirm your order', 'No surprises when you apply them'], closing: '' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'they save time.', reviewsSub: 'And when you label a lot, that makes the difference.'
		},
		fogli_adesivi: {
			name: 'Sticker sheets', title: 'Sticker sheets',
			seoTitle: 'Custom sticker sheets with multiple designs | Stickerprint',
			seoDesc: 'Custom sticker sheets with several designs on one sheet: three formats, portrait or landscape, kiss-cut on every sticker. Great for packs, merch and sets.',
			seoCategory: 'Sticker sheets',
			sub: 'The smartest way to build packs, sets and collections.',
			desc: 'Put several stickers, even different ones, on a single sheet. You lay them out or we do it for you. Ideal for merch, events, packaging and ready-to-go packs.',
			checks: ['Get an instant preview', 'Estimated ship date: {ship} · free shipping from {soglia}', 'Kiss-cut on every sticker (easy to peel)', 'Different shapes on the same sheet', 'We only print if it looks right'],
			cosa: 'Custom sticker sheets with several designs in one layout. Each sticker is cut individually but stays on the sheet. Perfect when you want variety, order and a professional result.',
			faq: [
				{ q: 'How many different stickers can I put on one sheet?', a: 'As many as you want, even with completely different designs. We arrange them in the best layout, or you can tell us the arrangement you prefer.' },
				{ q: 'Do I need white ink?', a: 'Usually not. Sticker sheets are printed on white vinyl, so white is already there as the base. White ink is only needed when you want an opaque white on clear or colored materials.' },
				{ q: 'How long do they last outdoors?', a: 'Our sticker sheets are made with high-quality materials and a protective laminate. They resist water, oil, food and daily use. They are designed mainly for packaging, products and shipping, and keep their quality over time.' },
				{ q: 'How does the kiss-cut work?', a: 'The kiss-cut cuts only the sticker, without going through the backing sheet. That way each sticker peels off the sheet easily, ready to apply. It’s the ideal solution for packs, sets and collections.' },
				{ q: 'Can I have different shapes on the same sheet?', a: 'Absolutely. You can mix round, square, rectangular, oval and die-cut stickers on the same sheet. Each sticker gets its own custom kiss-cut, so you can build sets and collections exactly the way you want.' },
			],
			faqTitle: 'Frequently asked questions about sticker sheets',
			cta: 'your sticker sheets',
			care: { title: 'Every sticker', hl: 'right where it belongs.', intro: 'You focus on the design. We take care of the rest, for real.', checks: ['File and cut margins checked', 'Kiss-cut verified on every sticker', 'We fix the layout if needed', 'Instant preview before you pay', 'Into print as soon as you confirm your order'], closing: 'No surprises. No wasted sheets.' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'real orders, real use.', reviewsSub: 'Honest opinions.'
		},
		vetrofanie: {
			name: 'Window decals', title: 'Window decals',
			seoTitle: 'Custom window decals for storefronts and offices | Stickerprint',
			seoDesc: 'Vinyl window decals applied inside the glass and read from outside: cut to size, crisp colors, instant preview. For storefronts, offices and shops.',
			seoCategory: 'Window decals',
			sub: 'Seen from outside. Perfect inside.',
			desc: 'Decals designed to go on the inside of the glass and read perfectly from the outside. Clean, professional, built to last on storefronts, offices and commercial spaces.',
			checks: ['Applied inside, read perfectly from outside', 'Durable vinyl, crisp colors', 'Precise cut to size', 'Get an instant preview', 'We only print if it looks right'],
			cosa: 'Vinyl window decals with front-facing adhesive, designed to be applied on the inside of storefronts and windows. Long-lasting protection, clean look, clear and professional messaging. For when your message has to last as long as your business.',
			faq: [
				{ q: 'Do window decals have a protective laminate?', a: 'Yes, our window decals are protected with a clear laminate that resists scratches and UV rays. It keeps the colors vivid and the text legible over time, even in direct sunlight.' },
				{ q: 'Do I need white ink?', a: 'Yes, white is essential for window decals. Since they are applied on the inside of the glass and read from the outside, white ink makes sure the colors are opaque and visible through the glass. Without white, the decal would look see-through.' },
				{ q: 'How long do they last outdoors?', a: 'Window decals are built to last. Because they go on the inside of the glass, they are shielded from outdoor weather. The vinyl and laminate resist UV rays and keep the colors crisp for several years.' },
				{ q: 'How do I apply window decals?', a: 'Window decals go on the inside of the glass, adhesive side toward the surface. They read perfectly from the outside thanks to mirrored printing. Application is simple: clean the glass, position the decal and press to push out any air bubbles.' },
				{ q: 'Can I use them on any glass?', a: 'Yes, window decals work on any smooth glass surface: storefronts, office windows, glass doors, car windows and more. The adhesive is designed to grip the glass perfectly and leave no residue when removed.' },
			],
			faqTitle: 'Frequently asked questions about window decals',
			cta: 'your window decals',
			care: { title: 'Zero stress.', hl: 'Even on glass.', intro: 'You upload the file. We handle the rest. Window decals look simple, but orientation, edges and the final look all need attention. That’s why we check everything before printing.', checks: ['Orientation and mirroring checked', 'Edges and cut verified for application on glass', 'Instant preview before you pay', 'We print what you saw', 'No surprises on the result'], closing: '' },
			reviewsTitle: 'Spoiler:', reviewsHl: 'they get noticed. Big time.', reviewsSub: 'Real storefronts. Real feedback.'
		}
	},
	kit: { price: '$12', checks: ['Get our best stickers', 'Feel the quality for yourself', 'Try all of our products', 'Pick the perfect material for you', 'Credited back right away on your first order'] }
};
