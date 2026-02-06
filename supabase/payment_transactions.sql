-- Payment Transactions tablosu
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    transaction_id TEXT,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'TRY',
    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending', 'processing', 'success', 'failed', 'cancelled'
    
    -- Kart bilgileri (sadece son 4 hane - güvenlik)
    card_last_four TEXT,
    card_holder_name TEXT,
    
    -- Garanti response bilgileri
    bank_response_code TEXT,
    bank_response_message TEXT,
    bank_transaction_id TEXT,
    bank_auth_code TEXT,
    bank_host_ref_num TEXT,
    bank_eci TEXT,
    bank_cavv TEXT,
    
    -- 3D Secure
    is_3d_secure BOOLEAN DEFAULT true,
    md_status TEXT,
    
    -- Hata durumu
    error_code TEXT,
    error_message TEXT,
    
    -- Raw response (debug için)
    raw_request JSONB,
    raw_response JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at);

-- Orders tablosuna payment alanları ekle
ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS payment_transaction_id UUID REFERENCES payment_transactions(id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transactions_updated_at();

-- RLS Policies
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi ödemelerini görebilir
CREATE POLICY "Users can view their own payments" ON payment_transactions
    FOR SELECT
    USING (
        order_id IN (
            SELECT id FROM orders WHERE user_id = auth.uid()
        )
    );

-- Service role (backend) tüm işlemleri yapabilir
CREATE POLICY "Service role can do everything" ON payment_transactions
    FOR ALL
    USING (auth.role() = 'service_role');
