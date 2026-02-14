import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Clock } from 'lucide-react';
import type { Blog } from '../types/blog';
import { motion } from 'framer-motion';

const BlogPostPage: React.FC = () => {
    const { slug } = useParams();
    const [blog, setBlog] = useState<Blog | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (slug) {
            fetchBlog(slug);
        }
    }, [slug]);

    const fetchBlog = async (postSlug: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('slug', postSlug)
            .eq('is_active', true)
            .single();

        if (error) {
            console.error('Error fetching blog post:', error);
            // Redirect to 404 or blog listing if not found
            // navigate('/blog'); 
        } else {
            setBlog(data);
        }
        setLoading(false);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f0c961]"></div>
            </div>
        );
    }

    if (!blog) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Yazı Bulunamadı</h1>
                <p className="text-gray-500 mb-8">Aradığınız blog yazısı yayından kaldırılmış veya taşınmış olabilir.</p>
                <Link to="/blog" className="bg-[#f0c961] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#e0b850] transition-colors">
                    Blog Listesine Dön
                </Link>
            </div>
        );
    }

    return (
        <article className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="relative h-[60vh] md:h-[70vh] w-full overflow-hidden">
                {/* Background Image */}
                {blog.image_url ? (
                    <div className="absolute inset-0">
                        <img
                            src={blog.image_url}
                            alt={blog.title}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30"></div>
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-gray-900"></div>
                )}

                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-end pb-16 md:pb-24">
                    <div className="container mx-auto px-4 relative z-10">

                        {/* Back Button */}
                        <div className="absolute top-[calc(-60vh+2rem)] left-4 md:left-0 md:top-[calc(-70vh+2rem)]">
                            <Link
                                to="/blog"
                                className="inline-flex items-center gap-2 text-white/90 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-md px-4 py-2 rounded-full transition-all text-sm font-medium border border-white/10"
                            >
                                <ArrowLeft size={16} />
                                Blog'a Dön
                            </Link>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="max-w-4xl"
                        >
                            {/* Tags */}
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                {blog.category && (
                                    <span className="bg-[#f0c961] text-black text-xs font-bold px-3 py-1.5 rounded-md uppercase tracking-wide">
                                        {blog.category}
                                    </span>
                                )}
                            </div>

                            {/* Title */}
                            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                                {blog.title}
                            </h1>

                            {/* Meta Info */}
                            <div className="flex flex-wrap items-center gap-6 text-white/80 text-sm md:text-base font-medium">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                                        <User size={16} />
                                    </div>
                                    <span>{blog.author || 'İçel Solar'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={18} />
                                    <span>{formatDate(blog.published_at)}</span>
                                </div>
                                {blog.reading_time && (
                                    <div className="flex items-center gap-2">
                                        <Clock size={18} />
                                        <span>{blog.reading_time}</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="container mx-auto px-4 py-16">
                <div className="max-w-3xl mx-auto">
                    {/* Excerpt if exists */}
                    {blog.excerpt && (
                        <div className="text-xl md:text-2xl font-medium text-gray-800 mb-10 leading-relaxed italic border-l-4 border-[#f0c961] pl-6 py-2">
                            {blog.excerpt}
                        </div>
                    )}

                    {/* Main Content */}
                    <div
                        className="prose prose-lg md:prose-xl prose-gray max-w-none 
                        prose-headings:font-bold prose-headings:text-gray-900 
                        prose-p:text-gray-600 prose-p:leading-relaxed 
                        prose-a:text-[#f0c961] prose-a:no-underline hover:prose-a:underline
                        prose-img:rounded-2xl prose-img:shadow-lg prose-img:my-8
                        prose-blockquote:border-l-[#f0c961] prose-blockquote:bg-gray-50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-lg"
                        dangerouslySetInnerHTML={{ __html: blog.content }}
                    ></div>


                </div>
            </div>
        </article>
    );
};

export default BlogPostPage;
