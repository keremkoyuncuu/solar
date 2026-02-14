-- Create blogs table
CREATE TABLE IF NOT EXISTS public.blogs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    excerpt TEXT,
    image_url TEXT,
    category TEXT,
    author TEXT,
    reading_time TEXT,
    is_active BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

-- Create policies for blogs table
-- Use DO block to check existence before creating policies to avoid errors on re-run
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'blogs' AND policyname = 'Public can view active blogs'
    ) THEN
        CREATE POLICY "Public can view active blogs" 
        ON public.blogs FOR SELECT 
        USING (is_active = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'blogs' AND policyname = 'Admins can manage blogs'
    ) THEN
        CREATE POLICY "Admins can manage blogs" 
        ON public.blogs FOR ALL 
        USING (auth.role() = 'authenticated') 
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
END
$$;

-- Create storage bucket for blog images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies with unique names
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access Blog Images'
    ) THEN
        CREATE POLICY "Public Access Blog Images" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'blog-images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload Blog Images'
    ) THEN
        CREATE POLICY "Authenticated users can upload Blog Images" 
        ON storage.objects FOR INSERT 
        WITH CHECK (bucket_id = 'blog-images' AND auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can update Blog Images'
    ) THEN
        CREATE POLICY "Authenticated users can update Blog Images" 
        ON storage.objects FOR UPDATE 
        USING (bucket_id = 'blog-images' AND auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete Blog Images'
    ) THEN
        CREATE POLICY "Authenticated users can delete Blog Images" 
        ON storage.objects FOR DELETE 
        USING (bucket_id = 'blog-images' AND auth.role() = 'authenticated');
    END IF;
END
$$;
