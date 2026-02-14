import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import type { Blog } from '../types/blog';
import { motion } from 'framer-motion';

const BlogPage: React.FC = () => {
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBlogs();
    }, []);

    const fetchBlogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('is_active', true)
            .order('published_at', { ascending: false });

        if (error) {
            console.error('Error fetching blogs:', error);
        } else {
            setBlogs(data || []);
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f0c961]"></div>
            </div>
        );
    }

    if (blogs.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 pt-32 pb-20 px-4 text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Blog</h1>
                <p className="text-gray-500">Henüz hiç blog yazısı bulunmuyor.</p>
            </div>
        );
    }

    const featuredPost = blogs[0];
    const otherPosts = blogs.slice(1);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section (Featured Post) */}
            <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        {/* Image */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                            className="relative rounded-2xl overflow-hidden shadow-xl aspect-video lg:aspect-[4/3] group"
                        >
                            {featuredPost.image_url ? (
                                <img
                                    src={featuredPost.image_url}
                                    alt={featuredPost.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                                    <span className="text-lg">Görsel Yok</span>
                                </div>
                            )}
                            {featuredPost.category && (
                                <div className="absolute top-4 left-4 bg-[#f0c961] text-black text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                                    {featuredPost.category}
                                </div>
                            )}
                        </motion.div>

                        {/* Content */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="flex flex-col justify-center space-y-6"
                        >
                            <div className="flex items-center gap-4 text-sm text-gray-500 font-medium">
                                <span className="flex items-center gap-1.5 text-[#f0c961]">
                                    <Calendar size={16} />
                                    {formatDate(featuredPost.published_at)}
                                </span>
                                {featuredPost.reading_time && (
                                    <span className="flex items-center gap-1.5">
                                        <Clock size={16} />
                                        {featuredPost.reading_time}
                                    </span>
                                )}
                            </div>

                            <Link to={`/blog/${featuredPost.slug}`} className="group">
                                <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 leading-tight group-hover:text-[#f0c961] transition-colors">
                                    {featuredPost.title}
                                </h1>
                            </Link>

                            <p className="text-lg text-gray-600 leading-relaxed line-clamp-3">
                                {featuredPost.excerpt || 'Bu yazının kısa özeti bulunmuyor.'}
                            </p>

                            <div className="pt-4">
                                <Link
                                    to={`/blog/${featuredPost.slug}`}
                                    className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-xl font-bold hover:bg-[#333] transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-xl group"
                                >
                                    Devamını Oku
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Other Posts Grid */}
            {otherPosts.length > 0 && (
                <section className="container mx-auto px-4 py-16">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-8 w-1.5 bg-[#f0c961] rounded-full"></div>
                        <h2 className="text-3xl font-bold text-gray-900">Diğer Yazılar</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {otherPosts.map((post, index) => (
                            <motion.article
                                key={post.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col h-full group"
                            >
                                <Link to={`/blog/${post.slug}`} className="block relative aspect-[16/9] overflow-hidden">
                                    {post.image_url ? (
                                        <img
                                            src={post.image_url}
                                            alt={post.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                                            <span>Görsel Yok</span>
                                        </div>
                                    )}
                                    {post.category && (
                                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-3 py-1 rounded-lg shadow-sm">
                                            {post.category}
                                        </div>
                                    )}
                                </Link>

                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {formatDate(post.published_at)}
                                        </span>
                                        {post.reading_time && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {post.reading_time}
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-[#f0c961] transition-colors">
                                        <Link to={`/blog/${post.slug}`}>
                                            {post.title}
                                        </Link>
                                    </h3>

                                    <p className="text-gray-600 text-sm line-clamp-3 mb-4 flex-1">
                                        {post.excerpt || 'Özet bulunmuyor...'}
                                    </p>

                                    <Link
                                        to={`/blog/${post.slug}`}
                                        className="inline-flex items-center gap-1 text-[#f0c961] font-bold text-sm hover:gap-2 transition-all mt-auto group/link"
                                    >
                                        Devamını Oku
                                        <ArrowRight size={16} className="group-hover/link:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </motion.article>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default BlogPage;
