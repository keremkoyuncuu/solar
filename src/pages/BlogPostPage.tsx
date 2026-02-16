import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Clock } from 'lucide-react';
import type { Blog } from '../types/blog';


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
            {/* Blog Header & Image */}
            <div className="pt-24 pb-8 md:pt-32 md:pb-12 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto">
                        {/* Back Button */}
                        <Link
                            to="/blog"
                            className="inline-flex items-center gap-2 text-gray-600 hover:text-black mb-8 transition-colors font-medium"
                        >
                            <ArrowLeft size={20} />
                            Blog'a Dön
                        </Link>

                        {/* Article Header */}
                        <div className="text-center mb-10">
                            {/* Category */}
                            {blog.category && (
                                <span className="inline-block bg-[#f0c961] text-black text-xs font-bold px-3 py-1.5 rounded-md uppercase tracking-wide mb-4">
                                    {blog.category}
                                </span>
                            )}

                            {/* Title */}
                            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                                {blog.title}
                            </h1>

                            {/* Meta Info */}
                            <div className="flex flex-wrap items-center justify-center gap-6 text-gray-600 text-sm md:text-base">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                                        <User size={16} />
                                    </div>
                                    <span className="font-medium">{blog.author || 'İçel Solar'}</span>
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
                        </div>

                        {/* Featured Image */}
                        {blog.image_url && (
                            <div className="w-full rounded-2xl overflow-hidden shadow-xl mb-8">
                                <img
                                    src={blog.image_url}
                                    alt={blog.title}
                                    className="w-full h-auto object-contain bg-gray-100"
                                />
                            </div>
                        )}
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
