-- Add promotion columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotion_tier VARCHAR(20); -- 'urgent', 'featured', 'turbo'
ALTER TABLE products ADD COLUMN IF NOT EXISTS promoted_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Create index for faster promoted products queries
CREATE INDEX IF NOT EXISTS idx_products_promoted ON products(is_promoted, promoted_until);
