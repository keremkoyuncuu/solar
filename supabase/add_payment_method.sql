-- Add payment_method column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'credit_card';

-- Add comment
COMMENT ON COLUMN orders.payment_method IS 'Payment method used: credit_card or eft';
