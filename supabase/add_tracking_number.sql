-- Orders tablosuna tracking_number sütunu ekle (eğer yoksa)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- Bu SQL'i Supabase SQL Editor'da çalıştırın
