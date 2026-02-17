import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ProductCard, { type Product } from '../../components/ProductCard';

const FeaturedProducts: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeaturedProducts = async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select(`
                        id,
                        name,
                        slug,
                        is_featured,
                        product_images(url, is_primary),
                        product_variants(id, name, base_price, stock, is_active, discount_percentage, discount_start_date, discount_end_date)
                    `)
                    .eq('is_active', true)
                    .eq('is_featured', true)
                    .limit(8)
                    .order('created_at', { ascending: false });

                if (error) {
                    throw error;
                }

                if (data) {
                    // Check user role
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

                    // If B2B, fetch global discount rate
                    let b2bDiscount = 0;
                    if (userRole === 'b2b') {
                        const { data: settingsData } = await supabase
                            .from('app_settings')
                            .select('value')
                            .eq('key', 'b2b_discount_percentage')
                            .maybeSingle();
                        b2bDiscount = settingsData?.value?.percentage || 0;
                    }

                    // Apply pricing
                    const now = new Date();
                    const productsWithDiscounts = data.map((p: any) => ({
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
                    setProducts(productsWithDiscounts as Product[]);
                }
            } catch (error) {
                console.error('Error fetching featured products:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFeaturedProducts();
    }, []);

    return (
        <section className="py-12 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                        Sizin İçin Seçtiklerimiz
                    </h2>
                    {/* Optional: View All Link */}
                    {/* <Link to="/products" className="text-[#6D4C41] hover:text-[#5D4037] font-medium text-sm">
                        Tümünü Gör &rarr;
                    </Link> */}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm h-[380px] animate-pulse">
                                <div className="bg-gray-200 h-[280px] w-full"></div>
                                <div className="p-4 space-y-3">
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                                    <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : products.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        Henüz vitrin ürünü eklenmemiş.
                    </div>
                )}
            </div>
        </section>
    );
};

export default FeaturedProducts;
