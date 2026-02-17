import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

import ProductCard from '../components/ProductCard';
import type { Product } from '../components/ProductCard';

// interface Product removed as it is imported


const Products: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProducts = async () => {

            try {
                // 1. Fetch Products & Variants (including discount fields)
                const { data: productsData, error: productError } = await supabase
                    .from('products')
                    .select('*, product_images(url, is_primary), product_variants(id, name, base_price, stock, discount_percentage, discount_start_date, discount_end_date)')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (productError) throw productError;

                let finalProducts = productsData || [];

                // 2. Check User Role for Pricing
                const { data: { session } } = await supabase.auth.getSession();
                let userRole = 'b2c';

                if (session) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    userRole = profile?.role || 'b2c';
                }

                // 3. If B2B, fetch global discount rate
                let b2bDiscount = 0;
                if (userRole === 'b2b') {
                    const { data: settingsData } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'b2b_discount_percentage')
                        .maybeSingle();
                    b2bDiscount = settingsData?.value?.percentage || 0;
                }

                // 4. Apply pricing + discounts (unified for B2B and B2C)
                const now = new Date();
                finalProducts = finalProducts.map(p => ({
                    ...p,
                    product_variants: (p.product_variants || []).map((v: any) => {
                        if (userRole === 'b2b') {
                            // B2B: sadece global iskonto — ana fiyatı üstü çizili göster
                            const b2bPrice = v.base_price * (1 - b2bDiscount / 100);
                            return {
                                ...v,
                                price: b2bPrice,
                                originalPrice: v.base_price,
                                hasDiscount: b2bDiscount > 0,
                                discount_percentage: b2bDiscount
                            };
                        }
                        // B2C: kampanya indirimi uygula
                        const discountActive = (v.discount_percentage || 0) > 0 &&
                            (!v.discount_start_date || new Date(v.discount_start_date) <= now) &&
                            (!v.discount_end_date || new Date(v.discount_end_date) >= now);
                        const finalPrice = discountActive
                            ? v.base_price * (1 - v.discount_percentage / 100)
                            : v.base_price;
                        return {
                            ...v,
                            price: finalPrice,
                            originalPrice: v.base_price,
                            hasDiscount: discountActive,
                            discount_percentage: v.discount_percentage || 0
                        };
                    })
                }));

                setProducts(finalProducts);
            } catch (err: any) {
                console.error('Error fetching products:', err);
                setError('Ürünler yüklenirken bir hata oluştu.');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // Animation Variants
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.03 // Reduced from 0.1 for faster loading feel
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 20 } }
    };

    return (
        <div className="bg-[#fffaf4] min-h-screen py-20">
            <div className="container mx-auto px-4">

                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-16 text-center"
                >
                    <span className="text-[#f0c961] font-bold text-xs uppercase tracking-[0.3em] mb-2 block">Premium Koleksiyon</span>
                    <h1 className="text-5xl font-black text-[#1a1a1a] mb-4 uppercase tracking-tighter">Ürün Kataloğu</h1>
                    <div className="w-20 h-1 bg-[#f0c961] mx-auto rounded-full mb-6"></div>
                    <p className="text-gray-500 max-w-2xl mx-auto font-light text-lg">
                        En son teknoloji ile üretilmiş, yüksek performanslı solar ve enerji depolama çözümlerimizi keşfedin.
                    </p>
                </motion.div>

                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 text-red-600 p-6 rounded-xl text-center border border-red-100 shadow-sm max-w-lg mx-auto">
                        <p className="font-bold">Bir hata oluştu</p>
                        <p className="text-sm">{error}</p>
                    </motion.div>
                )}

                {/* SKELETON LOADING GRID */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                            <div key={n} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm h-[350px] flex flex-col">
                                <div className="h-48 bg-gray-100 animate-pulse relative"></div>
                                <div className="p-4 flex-1 flex flex-col gap-3">
                                    <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse mx-auto"></div>
                                    <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse mx-auto"></div>
                                    <div className="mt-auto h-10 bg-gray-100 rounded-b-xl animate-pulse"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* PRODUCT GRID */
                    <motion.div
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8"
                    >
                        <AnimatePresence>
                            {products.map((product) => (
                                <motion.div
                                    key={product.id}
                                    variants={item}
                                    className="h-full"
                                >
                                    <ProductCard product={product} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}

                {!loading && products.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-32 text-gray-300">
                        <div className="text-8xl mb-6 opacity-30">🔍</div>
                        <p className="text-xl font-light">Aradığınız kriterlere uygun ürün bulunamadı.</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Products;
