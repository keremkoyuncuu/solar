-- 1. App Settings Tablosu (Global Ayarlar)
create table if not exists app_settings (
    key text primary key,
    value jsonb not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Varsayılan B2B İndirim Oranını Ekle (Varsayılan: %0)
insert into app_settings (key, value)
values ('b2b_discount_percentage', '{"percentage": 0}'::jsonb)
on conflict (key) do nothing;

-- 2. B2B Fiyat Listesi ID'sini Getiren Yardımcı Fonksiyon
create or replace function get_b2b_list_id()
returns int
language plpgsql
as $$
declare
    b2b_list_id int;
begin
    select id into b2b_list_id from price_lists where type = 'b2b' limit 1;
    
    if b2b_list_id is null then
        insert into price_lists (name, currency, type)
        values ('B2B Fiyat Listesi', 'TRY', 'b2b')
        returning id into b2b_list_id;
    end if;

    return b2b_list_id;
end;
$$;

-- 3. Trigger Fonksiyonu: TEK Ürün Fiyatı Değişince
create or replace function update_single_b2b_price()
returns trigger
language plpgsql
security definer
as $$
declare
    b2b_percentage numeric;
    b2b_list_id int;
    new_price numeric;
    settings_json jsonb;
begin
    -- Sadece base_price değiştiyse işlem yap (Performans için)
    if OLD.base_price = NEW.base_price then
        return new;
    end if;

    -- Global yüzdeyi al
    select value into settings_json
    from app_settings
    where key = 'b2b_discount_percentage';

    -- JSON'dan yüzdeyi çıkart (varsayılan 0)
    b2b_percentage := coalesce((settings_json->>'percentage')::numeric, 0);

    b2b_list_id := get_b2b_list_id();

    -- Yeni B2B fiyatını hesapla
    new_price := NEW.base_price * (1 - b2b_percentage / 100.0);

    -- variant_prices tablosunu güncelle
    insert into variant_prices (variant_id, price_list_id, price, is_active)
    values (NEW.id, b2b_list_id, new_price, true)
    on conflict (variant_id, price_list_id) 
    do update set price = excluded.price, updated_at = now();

    return new;
end;
$$;

-- 4. Trigger Fonksiyonu: GLOBAL Yüzde Değişince (Tümünü Güncelle)
create or replace function update_all_b2b_prices()
returns trigger
language plpgsql
security definer
as $$
declare
    b2b_percentage numeric;
    b2b_list_id int;
    rec record;
    new_price numeric;
begin
    -- Yeni yüzdeyi al
    b2b_percentage := coalesce((NEW.value->>'percentage')::numeric, 0);
    
    b2b_list_id := get_b2b_list_id();

    -- Tüm varyantları döngüye al ve güncelle
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

-- 5. Triggerları Atama

-- A) Ürün Fiyatı Değişince
drop trigger if exists on_variant_base_price_change on product_variants;
create trigger on_variant_base_price_change
after update on product_variants
for each row
execute function update_single_b2b_price();

-- B) Global Yüzde Değişince
drop trigger if exists on_b2b_percentage_change on app_settings;
create trigger on_b2b_percentage_change
after update on app_settings
for each row
when (OLD.value IS DISTINCT FROM NEW.value AND NEW.key = 'b2b_discount_percentage')
execute function update_all_b2b_prices();
