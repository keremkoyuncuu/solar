import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getOrCreateActiveCart, dispatchCartUpdate } from '../lib/cart';
import { useCurrency } from '../hooks/useCurrency';


interface ProductVariant {
    id: string;
    product_id: string;
    name: string;
    price?: number; // Calculated price (discounted)
    originalPrice?: number; // Original price before discount
    base_price: number; // DB price
    stock: number;
    is_active: boolean;
    discount_percentage?: number;
    hasDiscount?: boolean;
}

interface ProductImage {
    url: string;
    is_primary: boolean;
}

export interface Product {
    id: string;
    name: string;
    slug: string;
    created_at?: string;
    product_images?: ProductImage[];
    product_variants?: ProductVariant[];
    is_featured?: boolean;
    displayPrice?: number;
}

interface ProductCardProps {
    product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
    const { formatPrice } = useCurrency();
    const navigate = useNavigate();
    const [adding, setAdding] = useState(false);

    // Determine image to show
    const displayImage = product.product_images?.find(i => i.is_primary)?.url || product.product_images?.[0]?.url;

    // Determine price to show
    // If variants exist, we need to show a price. 
    // Ideally this should be passed in calculated, but if not, we use the first variant or "Fiyat Sorunuz"
    // Since we are fetching variants, we can use base_price of the first variant as a fallback display
    const variants = product.product_variants || [];
    // Find the cheapest variant and use its own originalPrice for consistent display
    const cheapestVariant = variants.length > 0
        ? variants.reduce((min, v) => ((v.price || v.base_price || 0) < (min.price || min.base_price || 0) ? v : min), variants[0])
        : null;
    const minPrice = cheapestVariant ? (cheapestVariant.price || cheapestVariant.base_price || 0) : 0;
    const matchingOriginalPrice = cheapestVariant ? (cheapestVariant.originalPrice || cheapestVariant.base_price || 0) : 0;
    const hasAnyDiscount = variants.some(v => v.hasDiscount);
    const maxDiscount = variants.length > 0
        ? Math.max(...variants.filter(v => v.hasDiscount).map(v => v.discount_percentage || 0))
        : 0;

    const handleAddToCart = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent Link navigation if wrapped
        e.stopPropagation();

        if (variants.length === 0) {
            // No variants? Navigate to product logic to handle error or display
            navigate(`/products/${product.slug}`);
            return;
        }

        // Case B: Multiple Variants -> Go to Detail
        if (variants.length > 1) {
            navigate(`/products/${product.slug}`);
            return;
        }

        // Case A: Single Variant -> Add to Cart
        const variant = variants[0];
        if (variant.stock <= 0) {
            alert('Üzgünüz, bu ürün stokta yok.');
            return;
        }

        setAdding(true);
        try {
            // Check if user is logged in (optional now!)
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id; // undefined if not logged in

            // 1. Get/Create Cart (works for both users and guests)
            const cartId = await getOrCreateActiveCart(userId);

            if (!cartId) {
                alert("Sepet oluşturulamadı. Lütfen tekrar deneyin.");
                setAdding(false);
                return;
            }

            // 2. Add Item
            const { data: existingItem } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('cart_id', cartId)
                .eq('variant_id', variant.id)
                .maybeSingle();

            if (existingItem) {
                await supabase
                    .from('cart_items')
                    .update({ quantity: existingItem.quantity + 1 })
                    .eq('id', existingItem.id);
            } else {
                await supabase
                    .from('cart_items')
                    .insert({
                        cart_id: cartId,
                        variant_id: variant.id,
                        quantity: 1
                    });
            }

            // Success Feedback
            dispatchCartUpdate(); // Header'daki sepet sayısını güncelle
            alert('Ürün sepete eklendi!');

        } catch (error) {
            console.error(error);
            alert('Bir hata oluştu.');
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full overflow-hidden group">
            <Link to={`/products/${product.slug}`} className="block relative">
                {/* Image Area: Square or 4:3 */}
                <div className="aspect-[4/3] bg-white p-4 flex items-center justify-center relative overflow-hidden">
                    {displayImage ? (
                        <img
                            src={displayImage}
                            alt={product.name}
                            loading="lazy"
                            width={400}
                            height={300}
                            className={`w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ${variants.length > 0 && variants[0].stock <= 0 && variants.length === 1 ? 'opacity-50 grayscale' : ''}`}
                        />
                    ) : (
                        <span className="text-4xl">📦</span>
                    )}

                    {/* Discount Badge */}
                    {hasAnyDiscount && maxDiscount > 0 && (
                        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                            %{maxDiscount}
                        </div>
                    )}

                    {/* Stock Badge */}
                    {variants.length > 0 && variants[0].stock <= 0 && variants.length === 1 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg transform -rotate-12 uppercase tracking-widest border-2 border-white">
                                Tükendi
                            </div>
                        </div>
                    )}

                    {/* Badge checks (optional, simplistic) */}
                    {/* <div className="absolute top-2 right-2 ..."></div> */}
                </div>

                {/* Content */}
                <div className="px-4 pt-2 pb-4 text-center">
                    <h3 className="text-gray-900 font-medium leading-snug line-clamp-2 mb-2 min-h-[2.5em] group-hover:text-[#6D4C41] transition-colors">
                        {product.name}
                    </h3>

                    {minPrice > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                            {hasAnyDiscount && matchingOriginalPrice > minPrice && (
                                <span className="text-sm text-gray-500 line-through decoration-red-500 decoration-2">
                                    {formatPrice(matchingOriginalPrice)}
                                </span>
                            )}
                            <span className={`text-lg font-bold ${hasAnyDiscount ? 'text-red-600' : 'text-[#6D4C41]'}`}>
                                {formatPrice(minPrice)}
                            </span>
                        </div>
                    ) : (
                        <div className="text-sm font-bold text-gray-400">
                            Fiyat Bilgisi İçin Tıklayın
                        </div>
                    )}
                </div>
            </Link>

            {/* Button */}
            <div className="mt-auto">
                <button
                    onClick={handleAddToCart}
                    disabled={adding || (variants.length === 1 && variants[0].stock <= 0)}
                    className="w-full bg-[#6D4C41] text-white font-bold py-3 text-sm tracking-wider hover:bg-[#5D4037] transition-colors disabled:opacity-70 disabled:cursor-not-allowed rounded-b-xl disabled:bg-gray-400"
                >
                    {adding ? 'EKLENİYOR...' : (variants.length === 1 && variants[0].stock <= 0 ? 'TÜKENDİ' : 'SEPETE EKLE')}
                </button>
            </div>
        </div>
    );
};

export default ProductCard;
