export interface Post {
	id: string;
	slug: string;
	title: string;
	excerpt: string | null;
	category: string;
	cover_url: string | null;
	content: string;
	author: string;
	published: boolean;
	published_at: string | null;
	created_at: string;
	updated_at: string;
}
export const postDate = (p: Pick<Post, 'published_at' | 'created_at'>) =>
	new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(p.published_at ?? p.created_at));
export const slugify = (s: string) =>
	s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
