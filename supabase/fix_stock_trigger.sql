-- Stok Yönetimi Düzeltmesi
-- Bu script trigger'ı kaldırır ve stok düşümünü payment-callback'e taşır

-- 1. TRIGGER'I KALDIR (Artık order_items insert'te stok düşmeyecek)
DROP TRIGGER IF EXISTS decrement_stock_trigger ON order_items;

-- 2. RPC FONKSİYONU OLUŞTUR (payment-callback bu fonksiyonu çağıracak)
CREATE OR REPLACE FUNCTION decrement_variant_stock(p_variant_id UUID, p_quantity INT)
RETURNS void AS $$
BEGIN
    UPDATE product_variants
    SET stock = stock - p_quantity
    WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC'ye izin ver (service role için)
GRANT EXECUTE ON FUNCTION decrement_variant_stock(UUID, INT) TO service_role;

-- NOT: Bu SQL'i Supabase SQL Editor'da çalıştırın!
-- Artık stok, sadece ödeme başarılı olduğunda payment-callback fonksiyonu tarafından düşürülecek.
