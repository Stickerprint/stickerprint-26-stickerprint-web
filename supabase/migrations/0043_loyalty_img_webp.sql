-- I badge dei livelli sono stati convertiti in webp (SEO/prestazioni): aggiorno i percorsi salvati in tabella.
update public.loyalty_levels set img = replace(img, '.png', '.webp') where img like '%.png';
