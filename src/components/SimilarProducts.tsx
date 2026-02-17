import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProductCard from './ProductCard';
import { Sparkles } from 'lucide-react';

interface SimilarProductsProps {
    currentProductId: string;
    categoryId: string | null;
}

const SimilarProducts: React.FC<SimilarProductsProps> = ({ currentProductId, categoryId }) => {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSimilarProducts = async () => {
            if (!categoryId) {
                setLoading(false);
                return;
            }

            // 1. Aynı kategorideki diğer ürünleri bul
            // Not: product_categories tablosu üzerinden gidiyoruz
            const { data: categoryProducts, error: cpError } = await supabase
                .from('product_categories')
                .select('product_id')
                .eq('category_id', categoryId);

            if (cpError || !categoryProducts || categoryProducts.length === 0) {
                setLoading(false);
                return;
            }

            const productIds = categoryProducts.map(cp => cp.product_id).filter(id => id !== currentProductId);

            if (productIds.length === 0) {
                setLoading(false);
                return;
            }

            // 2. Ürün detaylarını çek (Limit 4)
            const { data: productsData, error: pError } = await supabase
                .from('products')
                .select('id, name, slug, product_images(url, is_primary), product_variants(id, product_id, name, base_price, stock, is_active, discount_percentage, discount_start_date, discount_end_date)')
                .in('id', productIds)
                .eq('is_active', true)
                .limit(4);

            if (pError) {
                console.error('Error fetching similar products:', pError);
            } else {
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

                let b2bDiscount = 0;
                if (userRole === 'b2b') {
                    const { data: settingsData } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'b2b_discount_percentage')
                        .maybeSingle();
                    b2bDiscount = settingsData?.value?.percentage || 0;
                }

                const now = new Date();
                const productsWithDiscounts = (productsData || []).map((p: any) => ({
                    ...p,
                    product_variants: (p.product_variants || []).map((v: any) => {
                        if (userRole === 'b2b') {
                            const b2bPrice = v.base_price * (1 - b2bDiscount / 100);
                            return {
                                ...v,
                                price: b2bPrice,
                                originalPrice: v.base_price,
                                hasDiscount: b2bDiscount > 0,
                                discount_percentage: b2bDiscount
                            };
                        }
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
                setProducts(productsWithDiscounts);
            }
            setLoading(false);
        };

        fetchSimilarProducts();
    }, [currentProductId, categoryId]);

    if (loading) return null; // Loading state göstermeye gerek yok, sessizce yüklensin
    if (products.length === 0) return null;

    return (
        <div className="mt-16 mb-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="bg-[#fffaf4] p-3 rounded-full">
                    <Sparkles className="w-6 h-6 text-[#f0c961]" />
                </div>
                <h2 className="text-2xl font-black text-[#1a1a1a]">Benzer Ürünler</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        </div>
    );
};

export default SimilarProducts;
