export interface Blog {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    image_url?: string;
    category?: string;
    author?: string;
    reading_time?: string;
    is_active: boolean;
    published_at: string;
    created_at: string;
    updated_at: string;
}
