-- 1. price_lists tablosunda 'type' sütunu var mı kontrol et, yoksa ekle
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'price_lists' and column_name = 'type') then
        alter table price_lists add column type text;
    end if;
end $$;

-- 2. App Settings Tablosu (Global Ayarlar) - Eğer yoksa
create table if not exists app_settings (
    key text primary key,
    value jsonb not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

insert into app_settings (key, value)
values ('b2b_discount_percentage', '{"percentage": 0}'::jsonb)
on conflict (key) do nothing;

-- 3. B2B Fiyat Listesi ID'sini Getiren Fonksiyon (UUID Uyumlu)
create or replace function get_b2b_list_id()
returns uuid
language plpgsql
as $$
declare
    b2b_list_id uuid;
begin
    -- Önce 'type' sütununa göre ara
    select id into b2b_list_id from price_lists where type = 'b2b' limit 1;
    
    -- Bulunamazsa isme göre ara
    if b2b_list_id is null then
        select id into b2b_list_id from price_lists where name = 'B2B Fiyat Listesi' limit 1;
        
        if b2b_list_id is not null then
            update price_lists set type = 'b2b' where id = b2b_list_id;
        end if;
    end if;

    -- Hala yoksa yeni oluştur (UUID olarak)
    if b2b_list_id is null then
        insert into price_lists (name, currency, type)
        values ('B2B Fiyat Listesi', 'TRY', 'b2b')
        returning id into b2b_list_id;
    end if;

    return b2b_list_id;
end;
$$;

-- 4. Trigger Fonksiyonu: TEK Ürün Fiyatı Değişince
create or replace function update_single_b2b_price()
returns trigger
language plpgsql
security definer
as $$
declare
    b2b_percentage numeric;
    b2b_list_id uuid; -- UUID olarak değiştirildi
    new_price numeric;
    settings_json jsonb;
begin
    if OLD.base_price = NEW.base_price then
        return new;
    end if;

    -- Global yüzdeyi al
    select value into settings_json
    from app_settings
    where key = 'b2b_discount_percentage';

    b2b_percentage := coalesce((settings_json->>'percentage')::numeric, 0);
    
    -- UUID ID'yi al
    b2b_list_id := get_b2b_list_id();

    new_price := NEW.base_price * (1 - b2b_percentage / 100.0);

    insert into variant_prices (variant_id, price_list_id, price, is_active)
    values (NEW.id, b2b_list_id, new_price, true)
    on conflict (variant_id, price_list_id) 
    do update set price = excluded.price, updated_at = now();

    return new;
end;
$$;

-- 5. Trigger Fonksiyonu: GLOBAL Yüzde Değişince
create or replace function update_all_b2b_prices()
returns trigger
language plpgsql
security definer
as $$
declare
    b2b_percentage numeric;
    b2b_list_id uuid; -- UUID olarak değiştirildi
    rec record;
    new_price numeric;
begin
    b2b_percentage := coalesce((NEW.value->>'percentage')::numeric, 0);
    b2b_list_id := get_b2b_list_id();

    for rec in select id, base_price from product_variants loop
        new_price := rec.base_price * (1 - b2b_percentage / 100.0);

        insert into variant_prices (variant_id, price_list_id, price, is_active)
        values (rec.id, b2b_list_id, new_price, true)
        on conflict (variant_id, price_list_id) 
        do update set price = excluded.price, updated_at = now();
    end loop;

    return new;
end;
$$;

-- 6. Triggerları Yeniden Oluştur

drop trigger if exists on_variant_base_price_change on product_variants;
create trigger on_variant_base_price_change
after update on product_variants
for each row
execute function update_single_b2b_price();

drop trigger if exists on_b2b_percentage_change on app_settings;
create trigger on_b2b_percentage_change
after update on app_settings
for each row
when (OLD.value IS DISTINCT FROM NEW.value AND NEW.key = 'b2b_discount_percentage')
execute function update_all_b2b_prices();
